import { Component, ElementRef, NgZone, OnInit, ViewChild } from '@angular/core';
import { Router } from "@angular/router";
import { IValidCredential, ProofmeUtilsProvider, WebRtcProvider } from "@proofmeid/webrtc-web/proofmeid-webrtc-web";
import * as QRCode from 'qrcode';
import { filter, skip, takeUntil } from "rxjs/operators";
import { IAttributeRequest } from "../../interfaces/attributeRequest.interface";
import { RelayProvider } from "../../providers/relay-provider.service";
import { BaseComponent } from "../../shared/components";
import { AppStateFacade } from "../../state/app/app.facade";

@Component({
  selector: 'app-am',
  templateUrl: './am.component.html',
  styleUrls: ['./am.component.scss']
})
export class AmComponent extends BaseComponent implements OnInit {

  @ViewChild("qrCodeCanvas")
  qrCodeCanvas: ElementRef;

  requestedData: IAttributeRequest = {
    by: "Kiosk",
    description: "Access controle",
    credentials: [{
      key: "PHONE_NUMBER",
      required: true,
      expectedValue: null,
      provider: ['PHONE_NUMBER'],
    }],
    minimumRequired: []
  };

  signalingUrl = "wss://auth.proofme.id"
  web3Url = "https://api.didux.network/";
  validCredentialObj: IValidCredential = null;
  trustedAuthorities = ['0xa6De718CF5031363B40d2756f496E47abBab1515'] // ProofME production environment
  websocketDisconnected = false;
  accessGranted = false;
  accessDenied = false;

  constructor(
    private router: Router,
    private relayProvider: RelayProvider,
    private webRtcProvider: WebRtcProvider,
    private appStateFacade: AppStateFacade,
    private ngZone: NgZone,
    private proofmeUtilsProvider: ProofmeUtilsProvider
  ) {
    super();
  }

  ngOnInit(): void {
    this.setupWebRtc();
  }

  openDoor(slot) {
    const timeout = 5000;
    this.relayProvider.switchSlot(slot, timeout);
    this.accessGranted = true;
    setTimeout(() => {
      this.accessGranted = false;
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
          if(!this.accessGranted && !this.accessDenied) {
            setTimeout(() => {
              this.refreshWebsocketDisconnect()
            }, 1000);
          }
        }
      }
      if (data.action === "disconnect") {
        this.appStateFacade.setShowExternalInstruction(false);
        this.websocketDisconnected = true;
        if(!this.accessGranted && !this.accessDenied) {
          setTimeout(() => {
            this.refreshWebsocketDisconnect()
          }, 1000);
        }
      }
    });
  }

  async validateIdentifyData(data): Promise<void> {
    const identifyByCredentials = []
    for (const credential of this.requestedData.credentials) {
      identifyByCredentials.push({
        key: credential.key,
        provider: credential.provider
      })
    }

    this.validCredentialObj = await this.proofmeUtilsProvider.validCredentialsTrustedParties(data.credentialObject, this.web3Url, identifyByCredentials,this.trustedAuthorities);

    console.log("validCredentials result:", this.validCredentialObj);
    this.appStateFacade.setShowExternalInstruction(false);
    if (!this.validCredentialObj.valid) {
      this.ngZone.run(() => {
        this.accessDenied = true;
        this.accessGranted = false;
      });
      setTimeout(() => {
        this.refreshWebsocketDisconnect()
      }, 5000);
      console.error(this.validCredentialObj);
    } else {
      console.log("Success!!!")
      this.openDoor(1);
      this.ngZone.run(() => {
        this.accessDenied = false;
        this.accessGranted = true;
      });
      setTimeout(() => {
        this.refreshWebsocketDisconnect()
      }, 5000);
    }
  }

  async refreshWebsocketDisconnect() {
    this.ngZone.run(() => {
      this.accessDenied = false;
      this.accessGranted = false;
    });
    this.setupWebRtc();
  }

}
