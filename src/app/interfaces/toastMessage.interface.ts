export type ITYPE = "SUCCESS" | "ERROR" | "INFO" | "WARNING";

export interface IToastMessage {
    type: ITYPE;
    message: string;
}