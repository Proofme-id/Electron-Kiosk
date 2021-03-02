export class SetExternalInstructionStatus {
    static readonly type = '[App] SetExternalInstructionStatus';

    constructor(public status: boolean) {}
}
