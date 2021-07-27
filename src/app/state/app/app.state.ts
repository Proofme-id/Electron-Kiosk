import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Action, Selector, State, StateContext } from '@ngxs/store';
import { SetExternalInstructionStatus } from './actions/set-external-instruction-status';
import { SetLanguage } from './actions/set-language.action';
import { SendToastAction } from "./actions/toastMessage";
import { IToastMessage } from "../../interfaces/toastMessage.interface";
export interface IAppState {
    language: string;
    showExternalInstruction: boolean;
}

export interface IAppState {
    buildNumber: number;
    language: string;
    message: IToastMessage;
}


@State<IAppState>({
    name: 'app',
    defaults: {
        language: 'en',
        showExternalInstruction: false,
        buildNumber: 0,
        message: null
    }
})
@Injectable()
export class AppState {

    @Selector()
    static language(state: IAppState): string {
        return state.language;
    }

    @Selector()
    static showExternalInstruction(state: IAppState): boolean {
        return state.showExternalInstruction;
    }

    @Selector()
    static message(state: IAppState): IToastMessage {
        return state.message;
    }

    constructor(
        private http: HttpClient
    ) {}

    @Action(SetLanguage)
    setLanguage(ctx: StateContext<IAppState>, payload: SetLanguage): void {
        ctx.patchState({
            language: payload.language
        });
    }

    @Action(SetExternalInstructionStatus)
    setExternalInstructionStatus(ctx: StateContext<IAppState>, payload: SetExternalInstructionStatus): IAppState {
        console.log('setExternalInstructionStatus:', payload.status);
        return ctx.patchState({
            showExternalInstruction: payload.status
        });
    }

    @Action(SendToastAction)
    sendMessage(ctx: StateContext<IAppState>, payload: SendToastAction): void {
        ctx.patchState({
            message: payload.message
        });
    }
}
