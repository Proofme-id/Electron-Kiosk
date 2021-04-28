export interface ICredentialFormControl {
    text?: string;
    key: string;
    selected?: boolean;
    checked?: boolean;
    required?: boolean;
    expectedValue?: string;
    disabled?: boolean;
    color?: string;
    type?: string;
    credentialType?: string;
    value?: string | number | boolean;
    credentials?: ICredentialFormControl[];
}
