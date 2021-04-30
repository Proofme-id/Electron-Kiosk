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
  whitelist = this.StorageProvider.getKey("whitelistedUsers")
  showQR: boolean;

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
    this.storeRightTrustedAuthorities()
    this.setupWebRtc();
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

  async setupWebRtc() {
    this.webRtcProvider.launchWebsocketClient({
      signalingUrl: this.signalingUrl,
      isHost: true
    });

    this.webRtcProvider.uuid$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(uuid => {
      const canvas = this.qrCodeCanvas.nativeElement as HTMLCanvasElement;
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
        if (data.credentialObject) {
          await this.validateIdentifyData(data);
        } else {
          console.log("No credentials provided. Probably clicked cancel on the mobile app");
          if (!this.accessGranted && !this.accessDenied) {
            setTimeout(() => {
              this.refreshWebsocketDisconnect()
            }, 1000);
          }
        }
      }
      if (data.action === "disconnect") {
        this.appStateFacade.setShowExternalInstruction(false);
        this.websocketDisconnected = true;
        setTimeout(() => {
          this.refreshWebsocketDisconnect()
        }, 1000);
      }
    });
  }


  requestData(): IRequestedCredentials {
    let request: IRequestedCredentials;
    let credentials: boolean[]
    if (this.StorageProvider.hasKey("Credentials") && Object.values(this.StorageProvider.getKey("Credentials")).includes(true)) {
      this.showQR = true;
      credentials = this.StorageProvider.getKey("Credentials")
    } else {
      return request;
    }

    if (credentials && !this.StorageProvider.hasKey("WhitelistEnabled")) {
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
    } else if (this.StorageProvider.hasKey("WhitelistEnabled")) {
      console.log("whitelist enabled")
      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: []
      };
      if (this.StorageProvider.getKey("selectedWhitelist") === "phone") {
        request.credentials.push({
          key: "PHONE_NUMBER",
          required: true,
          expectedValue: 'true',
          provider: 'PHONE_NUMBER',
        })
      }
      else if (this.StorageProvider.getKey("selectedWhitelist") === "email") {
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

  async validateIdentifyData(data): Promise<void> {
    this.validCredentialObj = await this.proofmeUtilsProvider.validCredentialsTrustedParties(data.credentialObject, this.web3Url, this.requestedData, this.trustedAuthorities, true);
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
        this.refreshWebsocketDisconnect()
      }, 2500);
      console.error(this.validCredentialObj);
    } else {
      if (this.StorageProvider.hasKey("WhitelistEnabled")) {
        if (data.credentialObject.credentials.EMAIL != undefined) {
          if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 1) === 1) {
            console.log("Success!!!")
            log.info('6 ' + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
            this.openDoor(1)
            this.ngZone.run(() => {
              this.accessDenied = false;
              this.accessGranted = true;
            });
          }
          else {
            log.warn('7 ' + data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value);
            this.ngZone.run(() => {
              this.accessDenied = true;
              this.accessGranted = false;
            });
          }
        }
        else if (data.credentialObject.credentials.PHONE_NUMBER != undefined) {
          if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 0) === 1) {
            console.log("Success!!!")
            log.info('6 ' + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
            this.openDoor(1)
            this.ngZone.run(() => {
              this.accessDenied = false;
              this.accessGranted = true;
            });
          }
          else {
            log.warn('7 ' + data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value);
            this.ngZone.run(() => {
              this.accessDenied = true;
              this.accessGranted = false;
            });
          }
        }
      }
      else if (!this.StorageProvider.hasKey("WhitelistEnabled")) {
        console.log("Success!!!")
        this.openDoor(1)
        this.ngZone.run(() => {
          this.accessDenied = false;
          this.accessGranted = true;
        });
      }
    }
  }

  async refreshWebsocketDisconnect() {
    this.ngZone.run(() => {
      this.accessDenied = false;
      this.accessGranted = false;
    });
    this.setupWebRtc();
  }

  whitelistedExistsAndIsCorrect(whitelist: any, data: any, type: number): number {
    for (let whitelisted of whitelist) {
      if (type === 0) {
        if (whitelisted === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
          return 1;
        }
      }
      else if (type === 1) {
        if (whitelisted === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
          return 1;
        }
      }
    }
    return 0;
  }

}
