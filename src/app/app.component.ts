import { DOCUMENT } from "@angular/common";
import { Component, Inject, LOCALE_ID } from '@angular/core';
import { ElectronService } from './core/services';
import { TranslateService } from '@ngx-translate/core';
import { AppConfig } from '../environments/environment';
import { StorageProvider } from './providers/storage-provider.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  constructor(
    private electronService: ElectronService,
    private translate: TranslateService,
    private StorageProvider: StorageProvider,
    @Inject(LOCALE_ID) locale: string,
    @Inject(DOCUMENT) private document: Document
  ) {

    if (this.StorageProvider.getKey('language')) {
      this.translate.setDefaultLang(this.StorageProvider.getKey('language'));
      this.translate.use(this.StorageProvider.getKey('language'));
    }
    else
    {
      this.translate.setDefaultLang('en');
      this.translate.use('en');      
    }

    this.document.documentElement.lang = 'en';
    console.log('AppConfig', AppConfig);

    if (electronService.isElectron) {
      console.log(process.env);
      console.log('Run in electron');
      console.log('Electron ipcRenderer', this.electronService.ipcRenderer);
      console.log('NodeJS childProcess', this.electronService.childProcess);
    } else {
      console.log('Run in browser');
    }
  }
}
