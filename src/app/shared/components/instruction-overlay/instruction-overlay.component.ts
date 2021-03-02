import { Component } from '@angular/core';
import { AppStateFacade } from "../../../state/app/app.facade";

@Component({
    // tslint:disable-next-line: component-selector
    selector: 'instruction-overlay',
    templateUrl: 'instruction-overlay.component.html',
    styleUrls: ['instruction-overlay.component.scss']
})
export class InstructionOverlayComponent {
    showExternalInstruction$ = this.appStateFacade.showExternalInstruction$;

    constructor(
        private appStateFacade: AppStateFacade
    ) {

    }

}
