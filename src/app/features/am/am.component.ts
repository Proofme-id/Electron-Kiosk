import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { IRequestedCredentials, IRequestedCredentialsCheckResult, IValidatedCredentials, ProofmeUtilsProvider, WebRtcProvider } from "@proofmeid/webrtc-web";
import * as QRCode from 'qrcode';
import { filter, skip, takeUntil } from "rxjs/operators";
import { RelayProvider } from "../../providers/relay-provider.service";
import { BaseComponent } from "../../shared/components";
import { AppStateFacade } from "../../state/app/app.facade";
import { StorageProvider } from '../../providers/storage-provider.service'
import { Router } from '@angular/router';
const log = window['require']('electron-log')

@Component({
  selector: 'app-am',
  templateUrl: './am.component.html',
  styleUrls: ['./am.component.scss']
})
export class AmComponent extends BaseComponent implements OnInit {
  validCredentialObj: IValidatedCredentials | IRequestedCredentialsCheckResult = null;
  requestedData: IRequestedCredentials = this.requestData();
  @ViewChild("qrCodeCanvas")
  qrCodeCanvas: ElementRef;
  date = new Date().toISOString()
  logsPath: string = process.env.APPDATA + '/proofmeid-kiosk/logs/' || (process.platform == 'darwin' ? process.env.HOME + '/Library/Logs/proofmeid-kiosk/' : process.env.HOME + "/.config/proofmeid-kiosk/logs/")
  signalingUrl = "wss://auth.proofme.id"
  web3Url = "https://api.didux.network/";
  trustedAuthorities = []
  websocketDisconnected = false;
  accessGranted = false;
  accessDenied = false;
  whitelist: any[] = this.StorageProvider.getKey("whitelistedUsers")
  showQR: boolean;
  showEmailOverlay: boolean;
  @ViewChild("qrCodeCanvasEmail")
  qrCodeCanvasEmail: ElementRef;
  @ViewChild("qrCodeCanvasAddBiometrics")
  qrCodeCanvasAddBiometrics: ElementRef;
  addBiometricsToWhitelisted: boolean = false;
  showBiometricsOverlay: boolean = false;

  constructor(
    private router: Router,
    private relayProvider: RelayProvider,
    private webRtcProvider: WebRtcProvider,
    private appStateFacade: AppStateFacade,
    private StorageProvider: StorageProvider,
    private ngZone: NgZone,
    private proofmeUtilsProvider: ProofmeUtilsProvider
  ) {
    super();
  }

  storeRightTrustedAuthorities(): void {
    if (this.StorageProvider.hasKey('allowDemo')) {
      this.trustedAuthorities = ['0xa6De718CF5031363B40d2756f496E47abBab1515', '0x708686336db6A465C1161FD716a1d7dc507d1d17']
    }
    else if (!this.StorageProvider.hasKey('allowDemo')) {
      this.trustedAuthorities = ['0xa6De718CF5031363B40d2756f496E47abBab1515']
    }
  }

  ngOnInit(): void {
    log.transports.file.resolvePath = () => this.logsPath + this.date.substr(0, 10) + ".log";
    this.storeRightTrustedAuthorities();
    this.setupWebRtc('regular');

  }

  openDoor(slot) {
    const timeout = 5000;
    this.relayProvider.switchSlot(slot, timeout);
    this.accessGranted = true;
    setTimeout(() => {
      this.refreshWebsocketDisconnect();
    }, timeout);
  }

  searchRelays() {
    console.log(this.relayProvider.searchRelays())
  }

  setRelay(index) {
    console.log(this.relayProvider.setActiveRelay(index))
  }

  async setupWebRtc(type?: string) {
    this.webRtcProvider.launchWebsocketClient({
      signalingUrl: this.signalingUrl,
      isHost: true
    });

    this.webRtcProvider.uuid$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(uuid => {
      let canvas;
      if (type === "regular") {
        canvas = this.qrCodeCanvas.nativeElement as HTMLCanvasElement;
      } else if (type === "email") {
        canvas = this.qrCodeCanvasEmail.nativeElement as HTMLCanvasElement;
      } else if (type === "biometrics") {
        canvas = this.qrCodeCanvasAddBiometrics.nativeElement as HTMLCanvasElement;
      }
      this.websocketDisconnected = false;
      console.log('Create QR-code and show!');
      this.ngZone.run(() => {
        QRCode.toCanvas(canvas, `p2p:${uuid}:${encodeURIComponent(this.signalingUrl)}`, {
          width: 210
        });
      })
    });

    this.webRtcProvider.websocketConnectionClosed$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe((closed) => {
      this.websocketDisconnected = true;
    });

    this.webRtcProvider.receivedActions$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(async (data) => {
      // When the client is connected
      if (data.action === 'p2pConnected' && data.p2pConnected) {
        // Login with mobile
        this.appStateFacade.setShowExternalInstruction(true);
        if (type === "email" || type === "biometrics") {
          this.showEmailOverlay = false;
          this.showBiometricsOverlay = false;
        }
        if (type === "biometrics") {
          this.requestedData = this.requestData('biometrics')
        } else { this.requestedData = this.requestData() }
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
        if (data.credentialObject) {
          await this.validateIdentifyData(data);
        } else {
          console.log("No credentials provided. Probably clicked cancel on the mobile app");
          if (!this.accessGranted && !this.accessDenied) {
            if (type === "biometrics") {
              this.ngZone.run(() => {
                this.showBiometricsOverlay = false;
              })
            } else if (type === "email") {
              this.showEmailOverlay = false;
            }
            setTimeout(() => {
              this.refreshWebsocketDisconnect()
            }, 1000);
          }
        }
      }
      if (data.action === "disconnect") {
        this.appStateFacade.setShowExternalInstruction(false);
        this.websocketDisconnected = true;
        if (type === "biometrics") {
          this.ngZone.run(() => {
            this.showBiometricsOverlay = false;
          });
        } else if (type === "email") {
          this.showEmailOverlay = false;
        }
        setTimeout(() => {
          this.refreshWebsocketDisconnect()
        }, 1000);
      }
    });
  }


  requestData(type?: string): IRequestedCredentials {
    let request: IRequestedCredentials;
    let credentials: boolean[]
    if (this.StorageProvider.hasKey("Credentials") && Object.values(this.StorageProvider.getKey("Credentials")).includes(true)) {
      this.showQR = true;
      credentials = this.StorageProvider.getKey("Credentials")
    }

    if (type === 'biometrics' && this.StorageProvider.getKey('Whitelist').slice(0,1) === '0') {
      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: [{
          key: "BIOMETRICS_FACE_VECTORS",
          required: true,
          expectedValue: null,
          provider: 'BIOMETRICS_FACE_VECTORS',
        },
        {
          key: "EMAIL",
          required: true,
          expectedValue: 'true',
          provider: 'EMAIL',
        }]
      }
      return request;
    }

    if (type === 'biometrics' && this.StorageProvider.getKey('Whitelist').slice(0,1) === '1') {
      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: [{
          key: "BIOMETRICS_FACE_VECTORS",
          required: true,
          expectedValue: null,
          provider: 'BIOMETRICS_FACE_VECTORS',
        },
        {
          key: "PHONE_NUMBER",
          required: true,
          expectedValue: 'true',
          provider: 'PHONE_NUMBER',
        }]
      }
      return request;
    }

    if (credentials && this.StorageProvider.getKey('Whitelist').slice(2,3) === '0') {
      const allCredentials = [
        {
          key: "AIR_TICKET",
          required: true,
          expectedValue: null,
          provider: 'CUSTOM',
        },
        {
          key: "SOC_TICKET",
          required: true,
          expectedValue: null,
          provider: 'CUSTOM',
        },
        {
          key: "FES_TICKET",
          required: true,
          expectedValue: null,
          provider: 'CUSTOM',
        },
        {
          key: "VTEST_COR_PCR",
          required: false,
          expectedValue: 'false',
          provider: 'HEALTH'
        }, {
          key: "VTEST_COR_ANTIGEEN",
          required: false,
          expectedValue: 'false',
          provider: 'HEALTH',
        }, {
          key: "VTEST_COR_LAMP",
          required: false,
          expectedValue: 'false',
          provider: 'HEALTH',
        }, {
          key: "VPASS_COR_MODERNA",
          required: false,
          expectedValue: 'true',
          provider: 'HEALTH',
        }, {
          key: "VPASS_COR_PFIZER",
          required: false,
          expectedValue: 'true',
          provider: 'HEALTH',
        }
      ]
      const healthMinRequired = [
        "VTEST_COR_PCR",
        "VTEST_COR_ANTIGEEN",
        "VTEST_COR_LAMP",
        "VPASS_COR_MODERNA",
        "VPASS_COR_PFIZER"
      ]
      const allFiltered = allCredentials.filter(x => credentials[x.key] === true)
      const filteredMinRequired = healthMinRequired.filter(x => credentials[x] === true)

      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: allFiltered,
        minimumRequired: {
          amount: (filteredMinRequired.length > 0) ? 1 : 0,
          data: filteredMinRequired
        }
      };
    } else if (this.StorageProvider.getKey('Whitelist').slice(2,3) === '1' && !this.showBiometricsOverlay) {
      console.log("whitelist enabled")
      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: []
      };
      if (this.StorageProvider.getKey('Whitelist').slice(0,1) === '1' && !this.showBiometricsOverlay) {
        request.credentials.push({
          key: "PHONE_NUMBER",
          required: true,
          expectedValue: 'true',
          provider: 'PHONE_NUMBER',
        })
      }
      else if (this.StorageProvider.getKey('Whitelist').slice(0,1) === '0' && !this.showBiometricsOverlay) {
        request.credentials.push({
          key: "EMAIL",
          required: true,
          expectedValue: 'true',
          provider: 'EMAIL',
        })
      }

    }

    return request;
  }

  existsData(key: string): boolean {
    return this.StorageProvider.hasKey(key);
  }

  userAllowedIn(type: string, value: any, logType: string): void {
      if (type === "phone") {
        console.log("Success!!!")
        log.info(logType + value);
        this.openDoor(this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1)
        this.ngZone.run(() => {
          this.accessDenied = false;
          this.accessGranted = true;
        });
      }
      else if (type === "email") {
        console.log("Success!!!")
        log.info(logType + value);
        this.openDoor(this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1)
        this.ngZone.run(() => {
          this.accessDenied = false;
          this.accessGranted = true;
        });
      }
  }

  userNotAllowedIn(type: string, value: any, logType: string) {
    if (type === "phone") {
      log.warn(logType + value);
      this.ngZone.run(() => {
        this.accessDenied = true;
        this.accessGranted = false;
        setTimeout(() => {
          this.accessDenied = false;
        }, 1000);
      });
    } else if (type === "email") {
      
    }
  }

  async validateIdentifyData(data, type?: string): Promise<void> {
    let temp;
    if (data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS != undefined) {
      temp = data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS;
      delete data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS
      this.requestedData.credentials = this.requestedData.credentials.filter(x => {
        return x.key !== "BIOMETRICS_FACE_VECTORS"
      })
    }
    this.validCredentialObj = await this.proofmeUtilsProvider.validCredentialsTrustedParties(data.credentialObject, this.web3Url, this.requestedData, this.trustedAuthorities, true);
    if (temp != undefined) Object.assign(data.credentialObject.credentials, temp.credentials)
    console.log("validCredentials result:", this.validCredentialObj);
    this.appStateFacade.setShowExternalInstruction(false);
    if (!(this.validCredentialObj as IValidatedCredentials).valid) {
      if (data.credentialObject.credentials.EMAIL != undefined) {
        log.warn('1 ' + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
      } else if (data.credentialObject.credentials.PHONE_NUMBER != undefined) {
        log.warn('1 ' + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
      }
      this.ngZone.run(() => {
        this.accessDenied = true;
        this.accessGranted = false;
      });
      setTimeout(() => {
        if (type === "biometrics") {
          this.showBiometricsOverlay = false;
        } else if (type === "email") {
          this.showEmailOverlay = false;
        } else {
          this.refreshWebsocketDisconnect()
        }
      }, 1000);
      console.error(this.validCredentialObj);
    } else {
      if (this.StorageProvider.getKey('Whitelist').slice(2, 3) === "1") {
        const Whitelist = this.StorageProvider.getKey('Whitelist')
        switch (true) {
          case Whitelist === "1111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS != undefined: { //Biometrics enabled 
              this.whitelist.forEach(x => { 
                if (x.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value && x.hasBiometrics === "Disabled") {
                  x.biometrics = data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS.credentialSubject.credential.value.vectors
                  x.hasBiometrics = "Enabled"                
                }
              })
              console.log("TEST",this.whitelist)
              this.StorageProvider.setKey('whitelistedUsers',this.whitelist)
            break;
          }
          case Whitelist === "0111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS != undefined: {
            this.whitelist.forEach(x => { 
              if (x.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value && x.hasBiometrics === "Disabled") {
                x.biometrics = data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS.credentialSubject.credential.value.vectors
                x.hasBiometrics = "Enabled"                
              }
            })
            this.StorageProvider.setKey('whitelistedUsers',this.whitelist)
            break;
          }
          case Whitelist === "1111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS === undefined: {  
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 1) === 1) {
              this.userAllowedIn('phone', data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '6 ')
            } else {
              this.userNotAllowedIn('phone',data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          case Whitelist === "0111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS === undefined: { 
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 0) === 1) {
              this.userAllowedIn('email', data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '6 ')
            } else {
              this.userNotAllowedIn('email',data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '7 ')
            }         
            break;
          }
          case Whitelist === '1011': { 
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 1) === 1) {
              this.userAllowedIn('phone', data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '6 ')
            }
            else {
              this.userNotAllowedIn('phone',data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          case Whitelist === '0011': { 
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 0) === 1) {
              this.userAllowedIn('email', data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '6 ')
            }
            else {
              this.userNotAllowedIn('email',data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          default: {
            console.error('Whitelist',Whitelist)
            break;
          }
        }
      }
      else if (this.StorageProvider.getKey('Whitelist').slice(2, 3) === "0") {
        console.log("Success!!!")
        this.openDoor(this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1)
        this.ngZone.run(() => {
          this.accessDenied = false;
          this.accessGranted = true;
        });
      }
    }
  }

  async refreshWebsocketDisconnect(type?: string) {
    this.ngZone.run(() => {
      this.accessDenied = false;
      this.accessGranted = false;
    });
    if (type === "biometrics") {
      this.setupWebRtc('biometrics');
    } else if (type === "email") {
      this.setupWebRtc('email');
    } else {
      this.setupWebRtc('regular');
    }
  }

  whitelistedExistsAndIsCorrect(whitelist: any, data: any, type: number): number {
    for (let whitelisted of whitelist) {
      if (type === 1) {
        if (whitelisted.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
          return 1;
        }
      }
      else if (type === 0) {
        if (whitelisted.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
          return 1;
        }
      }
    }
    return 0;
  }

}
