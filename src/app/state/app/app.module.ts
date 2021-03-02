import { NgModule } from '@angular/core';
import { NgxsModule } from '@ngxs/store';
import { AppState } from './app.state';
import { AppStateFacade } from './app.facade';

@NgModule({
    imports: [
        NgxsModule.forFeature([AppState])
    ],
    providers: [
        AppStateFacade
    ]
})
export class AppStateModule {
    constructor() {}
}
