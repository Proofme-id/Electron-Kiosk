import { AfterViewInit, Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { IRequestedCredentials, IRequestedCredentialsCheckResult, IValidatedCredentials, ProofmeUtilsProvider, WebRtcProvider } from "@proofmeid/webrtc-web";
import * as QRCode from 'qrcode';
import { filter, skip, takeUntil } from "rxjs/operators";
import { RelayProvider } from "../../providers/relay-provider.service";
import { BaseComponent } from "../../shared/components";
import { AppStateFacade } from "../../state/app/app.facade";
import { StorageProvider } from '../../providers/storage-provider.service'
import { Router } from '@angular/router';
import * as log from "electron-log";
import * as faceapi from "face-api.js";
import { faCheck, faTimes, faUserPlus } from '@fortawesome/free-solid-svg-icons';

@Component({
  selector: 'app-am',
  templateUrl: './am.component.html',
  styleUrls: ['./am.component.scss']
})
export class AmComponent extends BaseComponent implements OnInit, AfterViewInit {
  faTimes = faTimes;
  faCheck = faCheck;
  faUserPlus = faUserPlus;
  validCredentialObj: IValidatedCredentials | IRequestedCredentialsCheckResult = null;
  requestedData: IRequestedCredentials = this.requestData();
  @ViewChild("regular")
  regular: ElementRef;
  @ViewChild("noBiometrics")
  noBiometrics: ElementRef;
  @ViewChild("biometrics")
  biometrics: ElementRef;
  @ViewChild('videoElement') videoElement: any;

  date = new Date().toISOString()
  logsPath: string = process.env.APPDATA + '/proofmeid-kiosk/logs/' || (process.platform == 'darwin' ? process.env.HOME + '/Library/Logs/proofmeid-kiosk/' : process.env.HOME + "/.config/proofmeid-kiosk/logs/")
  signalingUrl = "wss://auth.proofme.id";
  web3Url = "https://api.didux.network/";
  trustedAuthorities = []
  websocketDisconnected = false;
  accessGranted = false;
  accessDenied = false;
  whitelist: any[] = this.StorageProvider.getKey("whitelistedUsers")
  showQR: boolean;
  showNoBiometricsOverlay: boolean;

  addBiometricsToWhitelisted: boolean = false;
  showBiometricsOverlay: boolean = false;
  video: any;
  recogniseDistance = 0.5;
  onCooldown: boolean = false;
  accessCooldown: number = 15000;
  pauseInterval: boolean = false;
  hideEmailQR: boolean = false;
  streamTracker: any = null;
  noBiometricsFound: boolean = false;
  neutral: boolean = true;
  falseLogin: boolean = undefined;
  biometricsAccess: boolean = false;
  shouldShowQR: boolean;

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

    if (this.StorageProvider.getKey('Whitelist').slice(2, 3) != '0' && this.StorageProvider.getKey('Whitelist').slice(1, 2) === '1') {
      this.setupWebRtc('noBiometrics');
      this.startCamera();
    } else {
      document.getElementById("config-button").classList.remove("display-none")

      if (this.StorageProvider.hasKey("Credentials") && Object.values(this.StorageProvider.getKey("Credentials")).includes(true) ) {
        this.setupWebRtc('regular');
      }
    }
  }

  stopCamera(): void {
    if (this.streamTracker) {
      this.streamTracker.getTracks().forEach(track => {
        track.stop();
      });
      this.video.srcObject = null;
    }
  }

  async ngAfterViewInit() {
    await faceapi.loadSsdMobilenetv1Model("/assets/models");
    await faceapi.loadFaceLandmarkModel("/assets/models");
    await faceapi.loadFaceRecognitionModel("/assets/models");
    faceapi.env.monkeyPatch({
      Canvas: HTMLCanvasElement,
      Image: HTMLImageElement,
      ImageData: ImageData,
      Video: HTMLVideoElement,
      createCanvasElement: () => document.createElement('canvas'),
      createImageElement: () => document.createElement('img')
    })
  }

  startCamera(): void {
    this.initCamera({
      width: { min: 360, ideal: 1024 },
      height: { min: 360, ideal: 724 },
      frameRate: { ideal: 30, max: 60 },
      video: true, audio: false
    });
  }

  initCamera(config: any) {
    let browser = <any>navigator;

    let users = this.StorageProvider.getKey('whitelistedUsers');
    let labeledDescriptors = [];
    users.forEach(user => {
      let temp = new Float32Array(user.biometrics)
      if (temp.length > 0) {
        labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(
          user.credential,
          [temp]
        ))
      }
    });
    let FaceMatcher;
    if (labeledDescriptors.length == 0) {
      this.noBiometricsFound = true;
    } else {
      FaceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
      browser.getUserMedia = (browser.getUserMedia ||
        browser.webkitGetUserMedia ||
        browser.mozGetUserMedia ||
        browser.msGetUserMedia);
    }

    browser.mediaDevices.getUserMedia(config).then(stream => {
      this.video = this.videoElement.nativeElement;
      this.video.srcObject = stream;
      this.streamTracker = stream;
      document.getElementById("config-button").classList.remove("display-none")

      this.video.play().then(() => {
        setInterval(async () => {
          switch (true) {
            case this.pauseInterval === true: {
              return;
            }
            case this.onCooldown === true: {
              return;
            }
            case this.noBiometricsFound === true: {
              labeledDescriptors = [];
              users = this.StorageProvider.getKey('whitelistedUsers');
              this.neutral = false;
              users.forEach(user => {
                let temp = new Float32Array(user.biometrics)
                if (temp.length > 0) {
                  labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(
                    user.credential,
                    [temp]
                  ))
                }
              });
              if (labeledDescriptors.length == 0) {
                this.noBiometricsFound = true;
              } else {
                this.noBiometricsFound = false;
                FaceMatcher = new faceapi.FaceMatcher(labeledDescriptors);
                browser.getUserMedia = (browser.getUserMedia ||
                  browser.webkitGetUserMedia ||
                  browser.mozGetUserMedia ||
                  browser.msGetUserMedia);
              }
              this.falseLogin = true;
              setTimeout(() => {
                this.falseLogin = undefined;
                this.neutral = true;
              }, 1000);
              return;
            }
            default: {
              const singleResult = await faceapi.detectSingleFace(this.video).withFaceLandmarks().withFaceDescriptor()
              if (singleResult) {
                const bestMatch = FaceMatcher.findBestMatch(singleResult.descriptor);
                if (bestMatch.distance <= this.recogniseDistance) {
                  this.onCooldown = true;
                  this.neutral = false;
                  this.falseLogin = false;
                  let correctSlot = this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1
                  this.openDoor(correctSlot, "facialrecognition")

                  setTimeout(() => {
                    this.onCooldown = false;
                  }, this.accessCooldown);
                  return;
                } else {
                  this.falseLogin = true;
                  setTimeout(() => {
                    this.falseLogin = undefined;
                    this.neutral = true;
                  }, 1000);
                  return;
                }
              } else {
              }
            }
          }
        }, 2500)
      });
    });
  }

  openDoor(slot, type) {
    const timeout = 5000;
    this.relayProvider.switchSlot(slot, timeout);
    if (type != "facialrecognition") {
      this.accessGranted = true;
    } 

    if (type === "biometrics") {
      this.biometricsAccess = true;
      setTimeout(() => {
        this.refreshWebsocketDisconnect(type);
        this.neutral = true;
        this.falseLogin = undefined;
        this.pauseInterval = false;
      }, timeout);
    } else if (type === "noBiometrics") {
      setTimeout(() => {
        this.refreshWebsocketDisconnect(type);
        this.neutral = true;
        this.falseLogin = undefined;
        this.pauseInterval = false;
      }, timeout);
    } else {
      setTimeout(() => {
        this.refreshWebsocketDisconnect(type);
      }, timeout);
    }
  }

  searchRelays() {
    console.log(this.relayProvider.searchRelays())
  }

  setRelay(index) {
    console.log(this.relayProvider.setActiveRelay(index))
  }

  async setupWebRtc(type: any) {
    this.webRtcProvider.launchWebsocketClient({
      signalingUrl: this.signalingUrl,
      isHost: true
    });

    this.webRtcProvider.uuid$.pipe(skip(1), takeUntil(this.destroy$), filter(x => !!x)).subscribe(uuid => {
      let canvas;
      switch (type) {
        case "biometrics": {
          canvas = this.biometrics.nativeElement as HTMLCanvasElement;
          break;
        }
        case "noBiometrics": {
          canvas = this.noBiometrics.nativeElement as HTMLCanvasElement;
          break;
        }
        default: {
          canvas = this.regular.nativeElement as HTMLCanvasElement
        }
      }

      this.websocketDisconnected = false;
      console.log('Create QR-code and show!', type);
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
        this.falseLogin = undefined;
        this.pauseInterval = true;
        if (type === "noBiometrics" || type === "biometrics") {
          this.showNoBiometricsOverlay = false;
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
            } else if (type === "noBiometrics") {
              this.showNoBiometricsOverlay = false;
            }
            setTimeout(() => {
              this.refreshWebsocketDisconnect(type)
            }, 1000);
          }
        }
      }
      if (data.action === "disconnect") {
        this.appStateFacade.setShowExternalInstruction(false);
        this.falseLogin = undefined;
        this.pauseInterval = false;
        this.websocketDisconnected = true;
        if (type === "biometrics") {
          this.ngZone.run(() => {
            this.showBiometricsOverlay = false;
          });
        } else if (type === "noBiometrics") {
          this.showNoBiometricsOverlay = false;
        }
        setTimeout(() => {
          this.refreshWebsocketDisconnect(type)
        }, 1000);
      }
    });
  }


  requestData(type?: string): IRequestedCredentials {
    let request: IRequestedCredentials;
    let credentials: boolean[]

    if (this.StorageProvider.hasKey("Credentials") && Object.values(this.StorageProvider.getKey("Credentials")).includes(true) && this.StorageProvider.getKey('Whitelist').slice(1, 2) != "1"){
      this.showQR = true;
      credentials = this.StorageProvider.getKey("Credentials")
    }


    if (type === 'biometrics' && this.StorageProvider.getKey('Whitelist').slice(0, 1) === '0') {
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

    if (type === 'biometrics' && this.StorageProvider.getKey('Whitelist').slice(0, 1) === '1') {
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

    if (credentials && (this.StorageProvider.getKey('Whitelist').slice(2, 3) === '0' || this.StorageProvider.getKey('Whitelist') === '')) {
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
    } else if (this.StorageProvider.getKey('Whitelist').slice(2, 3) === '1' && !this.showBiometricsOverlay) {
      request = {
        by: "Kiosk",
        description: "Access controle",
        credentials: []
      };
      if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === '1' && !this.showBiometricsOverlay) {
        request.credentials.push({
          key: "PHONE_NUMBER",
          required: true,
          expectedValue: 'true',
          provider: 'PHONE_NUMBER',
        })
      }
      else if (this.StorageProvider.getKey('Whitelist').slice(0, 1) === '0' && !this.showBiometricsOverlay) {
        request.credentials.push({
          key: "EMAIL",
          required: true,
          expectedValue: 'true',
          provider: 'EMAIL',
        })
      }
      if (this.StorageProvider.getKey('Whitelist').slice(1, 2) != "1") {
        this.setupWebRtc('regular')
        this.showQR = true;
      }
    }

    return request;
  }

  existsData(key: string): boolean {
    return this.StorageProvider.hasKey(key);
  }

  getData(key: string): any {
    return this.StorageProvider.getKey(key);
  }

  userAllowedIn(value: any, logType: string, type: string): void {
    console.log("Success!!!")
    log.info(logType + value);
    this.openDoor(this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1, type)
    this.setupWebRtc(type)
    this.ngZone.run(() => {
      this.accessDenied = false;
      this.pauseInterval = true;
      this.accessGranted = true;
    });
  }

  userNotAllowedIn(value: any, logType: string) {
    log.warn(logType + value);
    this.ngZone.run(() => {
      this.accessDenied = true;
      this.accessGranted = false;
      setTimeout(() => {
        this.accessDenied = false;
      }, 2000);
    });
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
        } else if (type === "noBiometrics") {
          this.showNoBiometricsOverlay = false;
        } else {
          this.refreshWebsocketDisconnect("regular")
        }
      }, 1000);
      console.error(this.validCredentialObj);
    } else {
      if (this.StorageProvider.getKey('Whitelist').slice(2, 3) === "1") {
        const Whitelist = this.StorageProvider.getKey('Whitelist')
        switch (true) {
          case Whitelist === "1111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS != undefined: {
            this.whitelist.forEach(user => {
              if (user.credential === data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value) {
                if (user.hasBiometrics === "Enabled") {
                  this.appStateFacade.sendMessage({ message: "Updated your already existing biometrics", type: "SUCCESS" });
                } else {
                  user.hasBiometrics = "Enabled"
                  this.appStateFacade.sendMessage({ message: "Successfully added biometrics.", type: "SUCCESS" });
                }
                this.hideEmailQR = false;
                user.biometrics = data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS.credentialSubject.credential.value.vectors
              }
            })
            this.StorageProvider.setKey('whitelistedUsers', this.whitelist)
            break;
          }
          case Whitelist === "0111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS != undefined: {
            this.whitelist.forEach(user => {
              if (user.credential === data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value) {
                if (user.hasBiometrics === "Enabled") {
                  this.appStateFacade.sendMessage({ message: "Updated your already existing biometrics", type: "SUCCESS" });
                } else {
                  user.hasBiometrics = "Enabled"
                  this.appStateFacade.sendMessage({ message: "Successfully added biometrics.", type: "SUCCESS" });
                }
                this.hideEmailQR = false;
                user.biometrics = data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS.credentialSubject.credential.value.vectors
              }
            })
            this.StorageProvider.setKey('whitelistedUsers', this.whitelist)
            break;
          }
          case Whitelist === "1111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS === undefined: {
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 1) === 1) {
              this.userAllowedIn(data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '6 ', "noBiometrics")
            } else {
              this.userNotAllowedIn(data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          case Whitelist === "0111" && data.credentialObject.credentials.BIOMETRICS_FACE_VECTORS === undefined: {
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 0) === 1) {
              this.userAllowedIn(data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '6', "noBiometrics")
            } else {
              this.userNotAllowedIn(data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          case Whitelist === '1011': {
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 1) === 1) {
              this.userAllowedIn(data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '6 ', "regular")
            }
            else {
              this.userNotAllowedIn(data.credentialObject.credentials.PHONE_NUMBER.credentials.PHONE_NUMBER.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          case Whitelist === '0011': {
            if (this.whitelistedExistsAndIsCorrect(this.whitelist, data, 0) === 1) {
              this.userAllowedIn(data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '6 ', "regular")
            }
            else {
              this.userNotAllowedIn(data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, '7 ')
            }
            break;
          }
          default: {
            console.error('Whitelist', Whitelist)
            break;
          }
        }
      }
      else if (this.StorageProvider.getKey('Whitelist').slice(2, 3) === "0" || this.StorageProvider.getKey("Whitelist") === "") {
        console.log("Success!!!")
        this.openDoor(this.StorageProvider.hasKey('openDoorValue') ? this.StorageProvider.getKey('openDoorValue') : 1, "regular")
        this.ngZone.run(() => {
          this.accessDenied = false;
          this.accessGranted = true;
          this.pauseInterval = false;
        });
      }
    }
  }

  async refreshWebsocketDisconnect(type: string) {
    this.ngZone.run(() => {
      this.setupWebRtc(type);
      this.accessDenied = false;
      this.accessGranted = false;
    });
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
