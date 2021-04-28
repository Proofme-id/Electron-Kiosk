import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ICredentialFormControl } from "../../interfaces/credential-form-control.interface";
import { LAST_NAME, BIRTH_DATE, FIRST_NAME, PHONE_NUMBER, EMAIL, BIOMETRICS_FACE_VECTORS, VTEST_COR_PCR, VTEST_COR_ANTIGEEN, VTEST_COR_LAMP, VPASS_COR_MODERNA, VPASS_COR_PFIZER, CITY, COUNTRY_CODE, GENDER, HOUSE_NUMBER, INITIALS, LAST_NAME_PREFERRED, OLDER_THAN_18, POSTAL_CODE, STREET, DOCUMENT_EXPIRY_DATE, NATIONALITY, PERSONAL_NUMBER, PHOTO, DOCUMENT_NUMBER, OLDER_THAN_12, OLDER_THAN_16, OLDER_THAN_21 } from "./credentials.sub";
import { marker as _ } from "@biesbjerg/ngx-translate-extract-marker";

interface ICredentialsResponse {
    FIRST_NAME: {
        value: string,
        verifiers: any
    };
    LAST_NAME: {
        value: string,
        verifiers: any
    };
    BIOMETRICS_FACE_VECTORS: any;
    FUNNY_QUOTE: {
        value: string,
        verifiers: any
    };
}

_("SUBSCRIPTIONS.idin");
_("SUBSCRIPTIONS.epass");
_("SUBSCRIPTIONS.phone_number");
_("SUBSCRIPTIONS.email");
_("SUBSCRIPTIONS.biometrics");
_("SUBSCRIPTIONS.health");
_("SUBSCRIPTIONS.custom");
export const credentialProviders: ICredentialFormControl[] = [
    {
        text: "SUBSCRIPTIONS.idin",
        key: "IDIN",
        color: "#01b0f1",
        checked: false,
        credentials: [INITIALS, LAST_NAME, LAST_NAME_PREFERRED, STREET, HOUSE_NUMBER, POSTAL_CODE, CITY, COUNTRY_CODE, BIRTH_DATE, OLDER_THAN_12, OLDER_THAN_16, OLDER_THAN_18, OLDER_THAN_21, GENDER]
    },
    {
        text: "SUBSCRIPTIONS.epass",
        key: "EPASS",
        color: "#854a59",
        checked: false,
        credentials: [FIRST_NAME, LAST_NAME, PHOTO, GENDER, NATIONALITY, BIRTH_DATE, DOCUMENT_EXPIRY_DATE, PERSONAL_NUMBER, OLDER_THAN_12, OLDER_THAN_16, OLDER_THAN_18, OLDER_THAN_21, DOCUMENT_NUMBER]
    },
    {
        text: "SUBSCRIPTIONS.phone_number",
        key: "PHONE_NUMBER",
        color: "#000",
        checked: false,
        credentials: [PHONE_NUMBER]
    },
    {
        text: "SUBSCRIPTIONS.email",
        key: "EMAIL",
        color: "#d54b3d",
        checked: false,
        credentials: [EMAIL]
    },
    {
        text: "SUBSCRIPTIONS.biometrics",
        key: "BIOMETRICS_FACE_VECTORS",
        color: "#000",
        checked: false,
        credentials: [BIOMETRICS_FACE_VECTORS]
    },
    {
        text: "SUBSCRIPTIONS.health",
        key: "HEALTH",
        color: "#000",
        checked: false,
        credentials: [
            VTEST_COR_PCR,
            VTEST_COR_ANTIGEEN,
            VTEST_COR_LAMP,
            VPASS_COR_MODERNA,
            VPASS_COR_PFIZER
        ]
    },
    // {
    //     text: "SUBSCRIPTIONS.custom",
    //     key: "CUSTOM",
    //     color: "#000",
    //     checked: false
    // }
];

@Injectable()
export class CredentialProvider {

    constructor(private http: HttpClient) {}

    async getCredentials(smartcontract: string): Promise<ICredentialsResponse> {

        const result: any = await this.http.get(
            'https://demo-api.didux.io/v1/credentials/' + smartcontract
        ).toPromise();

        if (result) {
            return result;
        } else {
            return null;
        }
    }
}
