import { Injectable } from '@angular/core';
import { Select, Store } from '@ngxs/store';
import { Observable } from 'rxjs';
import { SetExternalInstructionStatus } from './actions/set-external-instruction-status';
import { SetLanguage } from './actions/set-language.action';
import { AppState } from './app.state';

@Injectable()
export class AppStateFacade {

    @Select(AppState.language)
    language$: Observable<string>;

    @Select(AppState.showExternalInstruction)
    showExternalInstruction$: Observable<boolean>;
    
    constructor(
        private store: Store,
    ) {}

    setLanguage(language: string): Observable<void> {
        return this.store.dispatch(new SetLanguage(language));
    }

    setShowExternalInstruction(status: boolean): Observable<void> {
        return this.store.dispatch(new SetExternalInstructionStatus(status));
    }
}
