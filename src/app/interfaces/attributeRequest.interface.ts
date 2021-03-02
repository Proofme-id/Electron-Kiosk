export interface IAttributeRequest {
    by: string;
    description: string;
    credentials: IAttributeRequestCredentials[];
    minimumRequired: IMinimumRequired[];
}

export interface IAttributeRequestCredentials {
    key: string;
    required: boolean;
    expectedValue: string;
    provider: string[];
}

export interface IMinimumRequired {
    data: string[];
    amount: number;
}

export interface ISettings {
    language: string;
    action: string;
    trustedAuthorities: string[];
}
