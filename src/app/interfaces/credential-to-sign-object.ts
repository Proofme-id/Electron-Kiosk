import * as moment from "moment";

export interface ICredentialToSignObject {
    mainKey: string;
    subKey: string;
    expirationType: moment.unitOfTime.DurationConstructor;
    expirationValue: number;
    credentialKey: string;
    credentialType: string;
    credentialValue: string | number | boolean;
    id: string;
    issuer: {
        authorityId: string;
        authorityName: string;
        authorityDid: string;
        name: string;
    },
    type: string[];
    provider: string;
    version: string;
}