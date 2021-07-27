import { IToastMessage } from "../../../interfaces/toastMessage.interface";

export class SendToastAction {
    static readonly type = "[App] SendToastAction";

    constructor(public message: IToastMessage) {}
}