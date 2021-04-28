import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule, HttpClient } from '@angular/common/http';
import { NgxsModule } from "@ngxs/store";
import { ProofmeUtilsProvider, WebRtcProvider } from "@proofmeid/webrtc-web/proofmeid-webrtc-web";
import { AppConfig } from "../environments/environment";
import { CoreModule } from './core/core.module';
import { AmModule } from "./features/am/am.module";
import { StorageProvider } from "./providers/storage-provider.service";
import { RelayProvider } from "./providers/relay-provider.service";
import { SharedModule } from './shared/shared.module';

import { FontAwesomeModule, FaIconLibrary } from '@fortawesome/angular-fontawesome';
import { fas } from '@fortawesome/free-solid-svg-icons';
import { AppRoutingModule } from './app-routing.module';

// NG Translate
import { TranslateModule, TranslateCompiler, TranslateLoader } from '@ngx-translate/core';
import { TranslateHttpLoader } from '@ngx-translate/http-loader';
import {TranslateMessageFormatCompiler} from 'ngx-translate-messageformat-compiler';

import { HomeModule } from './features/home/home.module';
import { ConfigModule } from "./features/config/config.module";

import { AppComponent } from './app.component';
import { AppStateModule } from "./state/app/app.module";

// AoT requires an exported function for factories
export function HttpLoaderFactory(http: HttpClient): TranslateHttpLoader {
  return new TranslateHttpLoader(http, './assets/i18n/', '.json');
}

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    CoreModule,
    SharedModule,
    FontAwesomeModule,
    NgxsModule.forRoot([], {
      developmentMode: !AppConfig.production
    }),
    HomeModule,
    ConfigModule,
    AmModule,
    AppRoutingModule,
    TranslateModule.forRoot({
      loader: {
        provide: TranslateLoader,
        useFactory: HttpLoaderFactory,
        deps: [HttpClient]
      },
      compiler: {
        provide: TranslateCompiler,
        useClass: TranslateMessageFormatCompiler
    }
    }),
    AppStateModule
  ],
  providers: [
    StorageProvider,
    RelayProvider,
    WebRtcProvider,
    ProofmeUtilsProvider
  ],
  bootstrap: [AppComponent]
})
export class AppModule {

  constructor(library: FaIconLibrary) {
    library.addIconPacks(fas);
  }
}
