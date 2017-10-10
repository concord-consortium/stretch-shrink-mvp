import { Context, Identifier, SharingParams, SharingParamName, SharingParamDefault } from 'cc-sharing';
import { parse, stringify } from "query-string";
import { isEqual } from "lodash";

interface Params extends SharingParams {
  sheetId?: Identifier;
  gridId?: Identifier;
  rulesOff?: boolean;
}

type ParamName = SharingParamName |
  "sheetId" |
  "gridId" |
  "rulesOff";

const params:Params={}
const listeners:Function[] = [];

const defaultParams = {
  sharing_offering: SharingParamDefault,
  sharing_class: SharingParamDefault,
  sharing_group: SharingParamDefault,
  sheetId: "sA38WgGZ",
  gridId: "c23xKskj",
  rulesOff: false
};

export function getParam(name:ParamName, _default:string="") {
  return params[name] || defaultParams[name] || _default;
}

export function updateHash() {
  window.location.hash = `${stringify(params)}`;
  notifyChange();
}

export function setParam(name:ParamName, value:any) {
  params[name] = value;
  updateHash();
}

export function setParamsWithDefaults(_newparams:Params) {
  Object.keys(defaultParams).forEach( (key:ParamName) => {
    const useDefault = _newparams[key] === undefined || _newparams[key] === null
    params[key] = useDefault ? defaultParams[key] : _newparams[key];
  });
  updateHash();
}


export function setParams(_newparams:Params) {
  Object.keys(_newparams).forEach( (key:ParamName) => {
    params[key] = _newparams[key];
  });
  updateHash();
}

export function addParamChangeListener(callbackF:Function) {
  listeners.push(callbackF);
}

function notifyChange() {
  listeners.forEach( (listener:Function) => listener());
}

function parseHashParams() {
  setParamsWithDefaults(parse(window.location.hash));
}

export function paramsFromContext(context:Context) {
  setParams({
    sharing_offering: context.offering,
    sharing_group:    context.group,
    sharing_class:    context.class
  })
}

function paramsFromAddress() {
  if(! isEqual(params, parse(window.location.hash))) {
    parseHashParams();
  }
}

paramsFromAddress();
window.addEventListener("onLoad", () => paramsFromAddress);
window.addEventListener("hashchange", paramsFromAddress, false);

