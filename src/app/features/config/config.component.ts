import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { AppStateFacade } from '../../state/app/app.facade';
import * as QRCode from 'qrcode';
import { IRequestedCredentialKey, IRequestedCredentials, IRequestedCredentialsCheckResult, IValidatedCredentials, ProofmeUtilsProvider, WebRtcProvider } from "@proofmeid/webrtc-web";
import { filter, skip, takeUntil } from "rxjs/operators";
import { BaseComponent } from "../../shared/components";
import { StorageProvider } from '../../providers/storage-provider.service'
import { TranslateService } from '@ngx-translate/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { marker as _ } from "@biesbjerg/ngx-translate-extract-marker";
import { Router } from '@angular/router';
import { RelayProvider } from '../../providers/relay-provider.service';
import { Device } from 'node-hid';
import * as moment from 'moment';

var logLines: logInfo[] = [];

@Component({
  selector: 'app-config',
  templateUrl: './config.component.html',
  styleUrls: ['./config.component.scss']
})
export class ConfigComponent extends BaseComponent implements OnInit {
  log = require('electron-log')
  fs = require('fs');
  path = require('path')
  readline = require('readline');
  window = require('electron').remote.getCurrentWindow();

  logInput: string = "";
  lines = [];
  date = new Date().toISOString()
  logsPath: string = process.env.APPDATA + '/proofmeid-kiosk/logs/' || (process.platform == 'darwin' ? process.env.HOME + '/Library/Logs/proofmeid-kiosk/' : process.env.HOME + "/.config/proofmeid-kiosk/logs/")
  readInterface;
  availableLogs: string[] = [];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  displayedColumns: string[] = ['type', 'time', 'message'];
  @ViewChild("qrCodeCanvas")
  qrCodeCanvas: ElementRef;
  @ViewChild("dateInput")
  dateInput: ElementRef;
  @ViewChild("qrCodeCanvasAdminRecovery")
  qrCodeCanvasAdminRecovery: ElementRef;
  @ViewChild("qrCodeCanvasAddAdmin")
  qrCodeCanvasAddAdmin: ElementRef;
  requestedData: IRequestedCredentials
  signalingUrl = "wss://auth.proofme.id"
  web3Url = "https://api.didux.network/";
  validCredentialObj: IValidatedCredentials | IRequestedCredentialsCheckResult = null;
  trustedAuthorities = ['0xa6De718CF5031363B40d2756f496E47abBab1515', '0x708686336db6A465C1161FD716a1d7dc507d1d17'] // ProofME production environment & ProofME Demo Environment
  websocketDisconnected: boolean = false;
  accessGranted: boolean = false;
  accessDenied: boolean = false;
  overlayClosed: boolean = false;
  dateToday: string = (moment()).format('YYYY-MM-DD');
  country = (this.translateService.currentLang === "en") ? "us" : this.translateService.currentLang;
  public isLanguageCollapsed = true;
  adminRecovery: boolean = false;
  offerAdminRecovery: boolean = false;
  showRecoveryQR: boolean = false;
  adminRecoveryCompleted: boolean = false;
  adminRecovered: boolean = false;
  admins: any = this.StorageProvider.hasKey('AdminInfo') ? this.StorageProvider.getKey('AdminInfo') : []
  whitelist = this.StorageProvider.getKey('whitelistedUsers')
  addToWhitelist: boolean = false;
  showAddAdminQR: boolean = false;
  addAdmin: boolean = false;
  alreadyExists: boolean = false;
  showAdmins: boolean = false;
  showSettings: boolean = false;
  showAm: boolean = false;
  showConfigWelcome: boolean = true;
  selectedCountryCode = this.StorageProvider.getKey('language') === "en" ? "gb" : (this.StorageProvider.getKey('language') ? this.StorageProvider.getKey('language') : "gb");
  countryCodes = ['gb', 'nl'];
  customLabels: Record<string, string> = { "gb": "English", "nl": "Nederlands" }
  requestedCredentials: any = this.StorageProvider.getKey('requestedCredentials')
  airChecked: boolean = false;
  socChecked: boolean = false;
  fesChecked: boolean = false;
  pcrChecked: boolean = false;
  antiChecked: boolean = false;
  lampChecked: boolean = false;
  modernChecked: boolean = false;
  pfizerChecked: boolean = false;
  selectedCredential: boolean = false;
  emailChecked: boolean = false;
  phoneChecked: boolean = false;
  input: string;
  emailWhitelist: boolean = false;
  phoneWhitelist: boolean = false;
  confirmDelete: boolean = false;
  isDemoAttributesAllowed: boolean = false;
  isWhitelistEnabled: boolean = false;
  showLogs: boolean = false;
  foundLog: boolean;
  dataSource = new MatTableDataSource<logInfo>(logLines);
  adminDataSource = new MatTableDataSource<string>(this.admins);
  relayDataSource = new MatTableDataSource<Device>(this.relayProvider.searchRelays());
  showLogsWelcome: boolean;
  adminDisplayedColumns: string[] = ['credential', 'remove'];
  whitelistDataSource = new MatTableDataSource<string>(this.whitelist);
  enableBiometrics: boolean = this.StorageProvider.hasKey('Whitelist') ? (this.StorageProvider.getKey('Whitelist').slice(1, 2) === "1") ? true : false : false
  whitelistDisplayedColumns: string[] = this.enableBiometrics === true ? ['credential', 'biometrics', 'hasAccess', 'remove'] : ['credential', 'hasAccess', 'remove']
  relayDisplayedColumns: string[] = ['name', 'slot', 'open']
  showWhitelist: boolean = false;
  showTutorialStep: number;
  showRelays: boolean = false;
  openDoorValue: number = (this.StorageProvider.hasKey('openDoorValue')) ? this.StorageProvider.getKey('openDoorValue') : 1;
  confirmAdminDelete: boolean = false;
  adminPhoneCredentials: boolean = false;
  adminEmailCredentials: boolean = false;
  confirmDataDelete: boolean = false;
  confirmWhitelistDelete: boolean = false;
  accessCooldownInput: string = (this.StorageProvider.hasKey('accessCooldown') ? ("" + (this.StorageProvider.getKey('accessCooldown') / 1000)) : '10');
  recogniseDistanceInput: string = (this.StorageProvider.hasKey("recogniseDistance")) ? ("" + this.StorageProvider.getKey("recogniseDistance")) : '0.5';

  constructor(
    private router: Router,
    private relayProvider: RelayProvider,
    private appStateFacade: AppStateFacade,
    private webRtcProvider: WebRtcProvider,
    private ngZone: NgZone,
    private proofmeUtilsProvider: ProofmeUtilsProvider,
    private StorageProvider: StorageProvider,
    private translateService: TranslateService,
  ) {
    super();
  }

  setPaginator(type: string): void {
    if (type === 'admin') {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.adminDataSource.paginator = this.paginator;
        });
      }, 25);
    }
    else if (type === 'logs') {
      this.ngZone.run(() => {
        this.dataSource.paginator = this.paginator;
      });
    }
    else {
      setTimeout(() => {
        this.ngZone.run(() => {
          this.whitelistDataSource.paginator = this.paginator;
        });
      }, 25);
    }
  }

  replaceAt(index: number, replacement: string, string: string): string {
    if (index >= string.length) {
      return string.valueOf();
    }
    return string.substring(0, index) + replacement + string.substring(index + 1);
  }

  updateWhitelistEnabled(): void {
    this.StorageProvider.getKey('Whitelist').slice(2, 3) === "1" ?
      this.StorageProvider.setKey('Whitelist', this.replaceAt(2, "0", this.StorageProvider.getKey("Whitelist"))) :
      this.StorageProvider.setKey('Whitelist', this.replaceAt(2, "1", this.StorageProvider.getKey("Whitelist")))
  }

  updateDemoAllowed(): void {
    this.existsData('allowDemo') ? this.deleteData('allowDemo') : this.storeData('allowDemo')
  }

  toggleKioskMode(): void {
    this.window.isKiosk() ? this.window.setKiosk(false) : this.window.setKiosk(true);
  }

  resetShow(): void {
    this.showAdmins = false;
    this.showConfigWelcome = false;
    this.showAm = false;
    this.showSettings = false;
    this.showWhitelist = false
    this.showLogs = false;
    this.showRelays = false;
  }

  storeData(key: string, value?: any): void {
    this.StorageProvider.setKey(key, (value) ? value : true);
  }

  deleteData(key: string): void {
    this.StorageProvider.deleteKey(key);
  }

  existsData(key: string): boolean {
    return this.StorageProvider.hasKey(key);
  }

  getData(key: string): any {
    return this.StorageProvider.getKey(key);
  }

  saveAccessSettings(): void {
    this.StorageProvider.setKey("Credentials", {
      AIR_TICKET: this.airChecked,
      SOC_TICKET: this.socChecked,
      FES_TICKET: this.fesChecked,
      VTEST_COR_PCR: this.pcrChecked,
      VTEST_COR_ANTIGEEN: this.antiChecked,
      VTEST_COR_LAMP: this.lampChecked,
      VPASS_COR_MODERNA: this.modernChecked,
      VPASS_COR_PFIZER: this.pfizerChecked
    })
    if (!this.StorageProvider.hasKey('firstStartupCompleted')) {
      this.StorageProvider.setKey('firstStartupCompleted', 'First time initialization Completed: ' + Date.now());
      this.showTutorialStep = 1;
      setTimeout(() => {
        this.ngZone.run(() => {
          this.showTutorialStep = 0;
        });
      }, 2500);
    }
  }

  saveGeneralSettings(): void {
    let temp: number = + (this.accessCooldownInput.replace(/[^0-9]*/g, ''))
    this.accessCooldownInput = "" + temp;
    this.StorageProvider.setKey('accessCooldown', (temp * 1000));

    temp = + this.recogniseDistanceInput
    switch (true) {
      case temp > 1:
        temp = 0.5;
        break;
      case temp < 0:
        temp = 0.5;
        break;
      default:
        break;
    }
    this.recogniseDistanceInput = "" + temp;
    this.StorageProvider.setKey('recogniseDistance', temp)
    this.appStateFacade.sendMessage({ message: "Successfully saved settings.", type: "SUCCESS" });
  }

  ngOnInit(): void {
    this.fillAvailableLogs()
    this.StorageProvider.hasKey('Whitelist') ? null : this.StorageProvider.setKey('Whitelist', '')
    this.getCorrectCredentials();
    if (!this.StorageProvider.hasKey('firstStartupCompleted')) {
      this.ngZone.run(() => {
        this.accessGranted = true;
        this.accessDenied = false;
        this.overlayClosed = true;
        this.showTutorialStep = 2;
      });
    }
    else if (this.admins.length < 1) {
      this.ngZone.run(() => {
        this.accessGranted = true;
        this.accessDenied = false;
        this.overlayClosed = true;
      });
    }

    this.log.transports.file.resolvePath = () => this.logsPath + this.date.substr(0, 10) + ".log";
    this.getCorrectValues();
    this.setupWebRtc("regular");
  }

  refreshRelays(): void {
    this.relayDataSource = new MatTableDataSource<Device>(this.relayProvider.searchRelays());
    if (this.relayDataSource.filteredData.length > 0) {
      this.relayProvider.setActiveRelay(0)
    }
  }

  openDoor(slot): void {
    const timeout = 5000;
    this.relayProvider.switchSlot(slot, timeout);
    this.accessGranted = true;
  }

  getRightDateAndLogs(event): void {
    var rightDate: any = event.value.getFullYear() + "-" + event.value.toISOString().substr(5, 2) + "-" + (event.value.getDate() > 9 ? event.value.getDate() : "0" + event.value.getDate());
    this.ifLogAvailable(rightDate);
  }

  ifLogAvailable(logName: string): boolean {
    if (this.availableLogs.includes(logName)) {
      logLines = [];
      this.readInterface = this.readline.createInterface({
        input: this.fs.createReadStream(this.logsPath + logName + ".log"),
        output: process.stdout,
        console: false
      });
      this.readInterface.on('line', function (line) {
        let splitLine = line.split(' ');
        logLines.push({
          time: line.substring(12, 20),
          type: line.substring(27, 31),
          messageType: splitLine[4],
          user: splitLine[5]
        })
      })
      setTimeout(() => {
        this.ngZone.run(() => {
          this.showLogsWelcome = false;
          this.foundLog = true;
          this.dataSource.data = logLines.reverse();
          this.dataSource.paginator = this.paginator;
        });
      }, 100);

      return true;
    }
    setTimeout(() => {
      this.ngZone.run(() => {
        this.showLogsWelcome = false;
        this.dataSource.data = []
        this.dataSource.paginator = this.paginator;
      });
    }, 100);
    this.foundLog = false;
    return false;
  }

  fillAvailableLogs(): boolean {
    this.availableLogs = [];
    this.fs.readdir(this.logsPath, (err, fileName) => {
      fileName.forEach(FN => {
        this.availableLogs.push(FN.substring(0, FN.length - 4));
      });
    });
    return true;
  }

  setAdminCredential(): void {
    if (this.adminPhoneCredentials) {
      this.StorageProvider.setKey('selectedAdminCredential', 'phone')
    }
    else if (this.adminEmailCredentials) {
      this.StorageProvider.setKey('selectedAdminCredential', 'email')
    }
  }

  getCorrectCredentials(): void {
    if (this.StorageProvider.getKey("selectedAdminCredential") === "phone") {
      this.requestedData =
      {
        by: "Kiosk",
        description: "Access controle",
        credentials: [{
          key: "PHONE_NUMBER",
          required: true,
          expectedValue: 'true',
          provider: 'PHONE_NUMBER',
        }]
      }

    } else if (this.StorageProvider.getKey("selectedAdminCredential") === "email") {
      this.requestedData =
      {
        by: "Kiosk",
        description: "Access controle",
        credentials: [{
          key: "EMAIL",
          required: true,
          expectedValue: 'true',
          provider: 'EMAIL',
        }]
      }
    }
  }

  deleteAdminList(): void {
    this.admins = [];
    this.StorageProvider.deleteKey('AdminInfo')
    this.StorageProvider.deleteKey('selectedAdminCredential')
  }

  deleteWhitelist(): void {
    this.StorageProvider.setKey('Whitelist', '')
    this.StorageProvider.setKey('whitelistedUsers', [])
    this.whitelist = this.StorageProvider.getKey('whitelistedUsers')
    this.emailWhitelist = false;
    this.phoneWhitelist = false;
    this.enableBiometrics = false;
  }

  getCorrectValues(): void {
    if (this.StorageProvider.hasKey('Credentials')) {
      const credentials = this.StorageProvider.getKey("Credentials")
      this.airChecked = credentials["AIR_TICKET"]
      this.socChecked = credentials["SOC_TICKET"]
      this.fesChecked = credentials["FES_TICKET"]
      this.pcrChecked = credentials["VTEST_COR_PCR"],
        this.antiChecked = credentials["VTEST_COR_ANTIGEEN"],
        this.lampChecked = credentials["VTEST_COR_LAMP"],
        this.modernChecked = credentials["VPASS_COR_MODERNA"],
        this.pfizerChecked = credentials["VPASS_COR_PFIZER"]
    }
  }

  changeSelectedCountryCode(value: string): void {
    this.selectedCountryCode = value;
    if (value === "gb") {
      value = "en";
    }
    this.StorageProvider.deleteKey(value);
    this.StorageProvider.setKey('language', value)
    this.appStateFacade.setLanguage(value);
    this.translateService.use(value);
    this.country = value;
  }

  async setupWebRtc(type: string) {
    if (type === "recovery") {
      this.adminRecovery = true;
      this.overlayClosed = false;
      this.websocketDisconnected = false;
    }

    this.webRtcProvider.launchWebsocketClient({
      signalingUrl: this.signalingUrl,
      isHost: true
    });

    this.webRtcProvider.uuid$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(uuid => {
      let canvas;
      if (type === "recovery") {
        canvas = this.qrCodeCanvasAdminRecovery.nativeElement as HTMLCanvasElement;
      }
      else if (type === "regular") {
        canvas = this.qrCodeCanvas.nativeElement as HTMLCanvasElement;
      }
      else if (type === "addAdmin") {
        canvas = this.qrCodeCanvasAddAdmin.nativeElement as HTMLCanvasElement
      }

      this.websocketDisconnected = false;
      console.log('Create QR-code and show!');
      this.ngZone.run(() => {
        QRCode.toCanvas(canvas, `p2p:${uuid}:${encodeURIComponent(this.signalingUrl)}`, {
          width: 210
        });
      })
      if (type === "recovery") {
        this.showRecoveryQR = true;
      }

    });

    this.webRtcProvider.websocketConnectionClosed$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe((closed) => {
      this.websocketDisconnected = true;
    });

    this.webRtcProvider.receivedActions$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(async (data) => {
      console.log('Received:', data);
      // When the client is connected
      if (data.action === 'p2pConnected' && data.p2pConnected) {
        // Login with mobile
        this.appStateFacade.setShowExternalInstruction(true);
        const timestamp = new Date();
        this.webRtcProvider.sendData("identify", {
          request: JSON.parse(JSON.stringify(this.requestedData)),
          type: "multiple",
          timestamp
        });
      }
      if (data.action === "identify") {
        // this.validCredentialObj = data.credentialObject
        console.log("Identify shared credentials:", data.credentialObject);
        console.log("Identify requested credentials:", this.requestedData);
        this.appStateFacade.setShowExternalInstruction(false);
        if (data.credentialObject) {
          await this.validateIdentifyData(data);
        } else {
          console.log("No credentials provided. Probably clicked cancel on the mobile app");
          if (!this.accessGranted && !this.accessDenied) {
            setTimeout(() => {
              if (type === "regular") {
                this.refreshWebsocketDisconnect("regular")
              } else if (type === "recovery") {
                this.refreshWebsocketDisconnect("recovery")
              }
              else if (type === "addAdmin") {
                this.refreshWebsocketDisconnect("addAdmin")
              } else {
                this.refreshWebsocketDisconnect("whitelist")
              }
            }, 1000);
          }
        }
      }
      if (data.action === "disconnect") {
        this.ngZone.run(() => {
          this.appStateFacade.setShowExternalInstruction(false);
          this.websocketDisconnected = true;
        });
        if (this.addAdmin) {
          this.refreshWebsocketDisconnect("addAdmin")
        } else if (this.addToWhitelist) {
          this.refreshWebsocketDisconnect("whitelist")
        }
        else if (!this.accessGranted && !this.accessDenied) {
          setTimeout(() => {
            if (type === "regular") {
              this.refreshWebsocketDisconnect("regular")
            } else if (type === "recovery") {
              this.refreshWebsocketDisconnect("recovery")
            }
          }, 1000);
        }
      }
    });
  }

  resetInput(): void {
    this.input = "";
  }

  selectedWhitelist(): string {
    if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === "0") {
      return "email"
    } else if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === "1") {
      return "phone"
    }
  }

  setWhitelistCredential(): void {
    if (this.emailWhitelist === true) {
      this.StorageProvider.setKey('Whitelist', "0000")
    } else if (this.phoneWhitelist === true) {
      this.StorageProvider.setKey('Whitelist', "1000")
    }
  }

  makeWhitelist(): void {
    if (this.enableBiometrics === true) {
      this.StorageProvider.setKey('Whitelist', this.StorageProvider.getKey('Whitelist').slice(0, 1) + "111")
    } else {
      this.StorageProvider.setKey('Whitelist', this.StorageProvider.getKey('Whitelist').slice(0, 1) + "011")
    }
  }

  updateAccess(userCredential): void {
    this.whitelist.forEach(user => {
      if (user.credential === userCredential) {
        user.hasAccess = !user.hasAccess;
        this.StorageProvider.setKey('whitelistedUsers', this.whitelist);
      }
    })
  }

  addUserToWhitelist(): void {
    if (this.whitelistedExistsAndIsCorrect(this.whitelist) === 0) {
      this.ngZone.run(() => {
        this.whitelist.push({
          credential: this.input,
          biometrics: [],
          hasBiometrics: 'Disabled',
          hasAccess: true,
        })
        this.ngZone.run(() => {
          this.whitelistDataSource = new MatTableDataSource<string>(this.whitelist);
          if (this.StorageProvider.getKey('Whitelist').slice(1, 2) === "1") {
            this.whitelistDisplayedColumns = ['credential', 'biometrics', 'hasAccess', 'remove'];
          } else {
            this.whitelistDisplayedColumns = ['credential', 'hasAccess', 'remove'];
          }
          this.whitelistDataSource.paginator = this.paginator;
        })
      });
      this.StorageProvider.setKey('whitelistedUsers', this.whitelist)
    } else if (this.whitelistedExistsAndIsCorrect(this.whitelist) === 1) {
      this.ngZone.run(() => {
        this.addToWhitelist = false;
        this.alreadyExists = true;
        this.overlayClosed = true;
      });
      setTimeout(() => {
        this.ngZone.run(() => {
          this.alreadyExists = false;
        });
      }, 3500);
    }
  }

  async validateIdentifyData(data): Promise<void> {
    this.validCredentialObj = await this.proofmeUtilsProvider.validCredentialsTrustedParties(data.credentialObject, this.web3Url, this.requestedData, this.trustedAuthorities, true);
    console.log("validCredentials result:", this.validCredentialObj);
    this.appStateFacade.setShowExternalInstruction(false);
    if (!(this.validCredentialObj as IValidatedCredentials).valid) {
      if (data.credentialObject.credentials.EMAIL != undefined) {
        this.log.warn('deniedInvalidCred ' + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
      } else if (data.credentialObject.credentials.PHONE_NUMBER != undefined) {
        this.log.warn('deniedInvalidCred ' + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
      }
      this.ngZone.run(() => {
        this.accessDenied = true;
        this.accessGranted = false;
      });
      setTimeout(() => {
        this.refreshWebsocketDisconnect("regular")
        this.closeOverlay
        this.accessDenied = false;
      }, 1500);
      console.error(this.validCredentialObj);
    }
    else if (this.addAdmin === true && this.adminExistsAndIsCorrect(this.admins, data) === 3) {
      this.pushRightCredental(data);
      this.adminDisplayedColumns = ['credential', 'remove'];
      this.adminDataSource.paginator = this.paginator;
      this.StorageProvider.setKey('AdminInfo', this.admins)
      this.adminDataSource = this.admins
      this.setPaginator('admin')
      this.ngZone.run(() => {
        this.addAdmin = false;
        this.overlayClosed = true;
      });
    }
    else if (this.addAdmin === true && this.adminExistsAndIsCorrect(this.admins, data) === 1) {
      this.ngZone.run(() => {
        this.alreadyExists = true;
        this.overlayClosed = true;
      });
      setTimeout(() => {
        this.ngZone.run(() => {
          this.alreadyExists = false;
        });
      }, 3500);
    }
    else if (this.adminExistsAndIsCorrect(this.admins, data) === 1 && this.adminRecovery === false) {
      this.logRightCredential(data, 'loggedIntoConfig ');
      console.log("Success!!!")
      this.ngZone.run(() => {
        this.accessDenied = false;
        this.accessGranted = true;
      });
      setTimeout(() => {
        this.ngZone.run(() => {
          this.closeOverlay();
        });
      }, 1500);
    }
    else if (this.adminExistsAndIsCorrect(this.admins, data) === 2 && this.adminRecovery === false) {
      this.logRightCredential(data, 'offerAdminRecover ');
      this.ngZone.run(() => {
        this.offerAdminRecovery = true;
        this.overlayClosed = false;
      });
    }
    else if (this.adminExistsAndIsCorrect(this.admins, data) === 2 && this.adminRecovery === true) {
      this.logRightCredential(data, 'adminRecovered ');
      this.ngZone.run(() => {
        this.accessGranted = true;
        this.accessDenied = false;
        this.recoverAdmin(this.admins, data);
        this.adminRecovery = false;
        this.adminRecoveryCompleted = true;
        this.adminRecovered = true;
        setTimeout(() => {
          this.closeOverlay();
        }, 2500);
      });
    }
    else {
      this.logRightCredential(data, 'configDeniedAccess ')
      this.ngZone.run(() => {
        this.accessDenied = true;
        this.accessGranted = false;
      });
      setTimeout(() => {
        this.ngZone.run(() => {
          this.refreshWebsocketDisconnect("regular")
          this.overlayClosed = true;
          this.accessDenied = false;
        });
      }, 1500);
    }
  }

  deleteAllStoredData(): void {
    let directory = this.logsPath.substring(0, this.logsPath.length - 1)
    this.fs.readdir(directory, (err, files) => {
      if (err) throw err;

      for (const file of files) {
        this.fs.unlink(this.path.join(directory, file), err => {
          if (err) throw err;
        });
      }
    });
    this.StorageProvider.deleteAllStored();
    this.router.navigate(['/home'])
  }

  logRightCredential(data: any, logType: string) {
    if (this.StorageProvider.getKey('selectedAdminCredential') === "email") {
      this.log.info(logType + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
    } else if (this.StorageProvider.getKey('selectedAdminCredential') === "phone") {
      this.log.info(logType + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
    }
  }

  pushRightCredental(data: any) {
    if (this.StorageProvider.getKey("selectedAdminCredential") === "phone") {
      this.admins.push({ did: data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.id.substring(10), credential: data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, credentialobject: data.credentialObject })
      this.log.warn('addedAdmin ' + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
    } else if (this.StorageProvider.getKey("selectedAdminCredential") === "email") {
      this.admins.push({ did: data.credentialObject.credentials.EMAIL.credentials.EMAIL.id.substring(10), credential: data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, credentialobject: data.credentialObject })
      this.log.warn('addedAdmin ' + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
    }
  }

  closeOverlay(): void {
    this.overlayClosed = true;
  }

  async refreshWebsocketDisconnect(type: string) {
    if (type === "recovery") {
      this.setupWebRtc(type);
    }
    else if (type === "regular") {
      this.setupWebRtc(type);
    }
    else if (type === "addAdmin") {
      this.setupWebRtc('addAdmin')
    }
  }

  whitelistedExistsAndIsCorrect(whitelist: any): number {
    for (let whitelisted of whitelist) {
      if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === "1") {
        if (whitelisted.credential === this.input) {
          return 1;
        }
      }
      else if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === "0") {
        if (whitelisted.credential === this.input) {
          return 1;
        }
      }
    }
    return 0;
  }

  adminExistsAndIsCorrect(admins: any, data: any): number {
    if (this.StorageProvider.getKey('selectedAdminCredential') === "email") {
      for (let admin of admins) {
        if (admin.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value && admin.did === data.credentialObject.credentials.EMAIL.credentials.EMAIL.id.substring(10)) {
          return 1;
        }
        else if (this.accessGranted && admin.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
          return 1;
        }
        else if (admin.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
          return 2;
        }
      }
    } else if (this.StorageProvider.getKey('selectedAdminCredential') === "phone") {
      for (let admin of admins) {
        if (admin.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value && admin.did === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.id.substring(10)) {
          return 1;
        }
        else if (this.accessGranted && admin.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
          return 1;
        }
        else if (admin.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
          return 2;
        }
      }
    }
    return 3;
  }

  recoverAdmin(admins: any, data: any): void {
    if (this.StorageProvider.getKey('selectedAdminCredential') === "email") {
      for (let i = 0; i < admins.length; i++) {
        if (admins[i].credentialobject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
          admins[i].did = data.credentialObject.credentials.EMAIL.credentials.EMAIL.id.substring(10)
          admins[i].credentialobject = data.credentialObject;
        }
      }
    } else if (this.StorageProvider.getKey('selectedAdminCredential') === "phone") {
      for (let i = 0; i < admins.length; i++) {
        if (admins[i].credentialobject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
          admins[i].did = data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.id.substring(10)
          admins[i].credentialobject = data.credentialObject;
        }
      }
    }
    this.StorageProvider.setKey('AdminInfo', admins)
  }

  deleteFromList(list: number, number: number): void {
    if (list === 1) {
      this.admins.splice(number, 1)
      this.StorageProvider.setKey('AdminInfo', this.admins)
      this.ngZone.run(() => {
        this.adminDisplayedColumns = ['credential', 'remove'];
        this.adminDataSource.paginator = this.paginator;
      })
    } else if (list === 2) {
      this.whitelist.splice(number, 1)
      this.StorageProvider.setKey('whitelistedUsers', this.whitelist)
      this.ngZone.run(() => {
        this.whitelistDisplayedColumns = ['credential', 'biometrics', 'hasAccess', 'remove'];
        this.whitelistDataSource.paginator = this.paginator;
      })
    }
  }
}

interface logInfo {
  type: string,
  time: string,
  messageType: string,
  user: string
}
