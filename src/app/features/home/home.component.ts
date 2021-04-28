import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { ICredential, IRequestedCredentials, IRequestedCredentialsCheckResult, IValidatedCredentials, ProofmeUtilsProvider, signCredentialObject, WebRtcProvider } from '@proofmeid/webrtc-web';
import { filter, skip, takeUntil } from 'rxjs/operators';
import { BaseComponent } from "../../shared/components";
import { AppStateFacade } from '../../state/app/app.facade';
import * as QRCode from 'qrcode';
import { ICredentialToSignObject } from '../../interfaces/credential-to-sign-object';
import * as moment from 'moment';
import { EMAIL } from '../credentials/credentials.sub';
import { ICredentialFormControl } from '../../interfaces/credential-form-control.interface';
import { StorageProvider } from '../../providers/storage-provider.service';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
@Component({
  selector: 'app-home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent extends BaseComponent implements OnInit {
  signalingUrl = "wss://auth.proofme.id"
  requestedData: IRequestedCredentials = {
    by: "ProofMe Id Demo",
    description: "Access controle",
    credentials: [{
      key: "EMAIL",
      required: true,
      expectedValue: null,
      provider: 'EMAIL'
    }]
  }

  country = (this.translateService.currentLang === "en") ? "us" : this.translateService.currentLang;
  web3Url = "https://api.didux.network/";
  validCredentialObj: IValidatedCredentials | IRequestedCredentialsCheckResult = null;
  websocketDisconnected = false;
  requestedCredentials: any[] = [];
  credentials: ICredentialFormControl[] = []
  trustedAuthorities = ['0xa6De718CF5031363B40d2756f496E47abBab1515', '0x708686336db6A465C1161FD716a1d7dc507d1d17']

  @ViewChild("qrCodeCanvas")
  qrCodeCanvas: ElementRef;
  selectedCountryCode = this.StorageProvider.getKey('language') === "en" ? "gb" : (this.StorageProvider.getKey('language') ? this.StorageProvider.getKey('language') : "gb");
  countryCodes = ['gb', 'nl'];
  customLabels: Record<string, string> = {
    "gb": "English",
    "nl": "Nederlands"
  }

  issuer = {
    did: '0x473bCB57aEf23F834D51e6441538E373BaeA1d5a',
    publicKey: '0xC21e3aFa4390ef845Bd6DE5F261a315630AFA62a',
    privateKey: '0xd6ff393091c8bb8cc3001c07650d42521823895f7c6883d95614bee228261566',
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

  ngOnInit(): void {
    if (this.existsData('firstStartupCompleted')) {
      this.router.navigate(['/am'])
    }
    this.setupWebRtc();
  }

  constructor(
    private router: Router,
    private webRtcProvider: WebRtcProvider,
    private appStateFacade: AppStateFacade,
    private ngZone: NgZone,
    private proofmeUtilsProvider: ProofmeUtilsProvider,
    private StorageProvider: StorageProvider,
    private translateService: TranslateService
  ) {
    super();
  }

  async validateIdentifyData(data): Promise<void> {
    this.validCredentialObj = await this.proofmeUtilsProvider.validCredentialsTrustedParties(data.credentialObject, this.web3Url, this.requestedData, this.trustedAuthorities, true);
    console.log("validCredentials result:", data.credentialObject);
    this.appStateFacade.setShowExternalInstruction(false);
    if (!(this.validCredentialObj as IValidatedCredentials).valid) {
      setTimeout(() => {
        this.refreshWebsocketDisconnect()
      }, 5000);
      console.error(this.validCredentialObj);
    } else {
      this.ngZone.run(() => {
        this.StorageProvider.setKey('firstStartupCompleted', 'First Startup Completed: ' + Date.now());
        this.StorageProvider.setKey('whitelistedUsers', [])
        this.StorageProvider.setKey('AdminInfo', [{ did: data.credentialObject.credentials.EMAIL.credentials.EMAIL.id.substring(10), email: data.credentialObject.credentials.EMAIL.credentials.EMAIL.credentialSubject.credential.value, credentialobject: data.credentialObject }])
        let request: IRequestedCredentials = {
          by: "Kiosk",
          description: "Access controle",
          credentials: []
        };;
        this.StorageProvider.setKey('requestedCredentials', request)
        this.router.navigate(['/am'])
      });
      setTimeout(() => {
        this.refreshWebsocketDisconnect()
      }, 5000);
    }
  }

  async setupWebRtc() {
    if (!this.StorageProvider.hasKey('firstStartupCompleted')) {
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
          console.log('this.requestedData', this.requestedData)
          this.webRtcProvider.sendData("identify", {
            request: this.requestedData,
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
            setTimeout(() => {
              this.refreshWebsocketDisconnect()
            }, 1000);
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
  }

  existsData(key: string): boolean {
    return this.StorageProvider.hasKey(key);
  }
  
  fillAttributes() {
    this.credentials.push(EMAIL);
    for (const credential of this.credentials) {
      this.requestedCredentials.push(JSON.parse(JSON.stringify({
        credential,
        provider: 'CUSTOM'
      })));
    }

  }

  async refreshWebsocketDisconnect() {
    this.setupWebRtc();
  }

  createCredentialObject(userDid: string, credentialToSignObject: ICredentialToSignObject): ICredential {
    return {
      credentialSubject: {
        credential: {
          type: credentialToSignObject.credentialType,
          value: credentialToSignObject.credentialValue
        },
      },
      expirationDate: moment().add(1, 'year').toISOString(),
      id: `did:didux:${userDid}`,
      issuanceDate: new Date().toISOString(),
      issuer: {
        authorityId: 'Proofme.ID Demo',
        authorityName: 'Proofme.ID Demo',
        id: `did:didux:${this.issuer.did}`,
        name: 'Proofme.ID Demo',
      },
      proof: {
        holder: this.issuer.publicKey,
        nonce: Date.now(),
        type: 'ECDSA',
      },
      provider: credentialToSignObject.provider,
      type: [
        'VerifiableCredential',
        `${credentialToSignObject.credentialType}Credential`
      ],
      version: '1.0.0',
    } as ICredential;
  }
}