import { Context } from 'cc-sharing';
export default class Sharing {
    context: Context;
    filename: string;
    name: string;
    getGeogAppletF: Function;
    constructor(_getAppF: Function, _name: string);
    setContext(_context: Context | null): void;
    share(): void;
}
