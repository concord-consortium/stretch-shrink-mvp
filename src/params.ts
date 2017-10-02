import { Context, Identifier } from 'cc-sharing';
import { parse, stringify } from "query-string";
import { isEqual } from "lodash";

interface Params {
  sharing_clazz?: Identifier;
  sharing_offering?: Identifier;
  sharing_group?: Identifier;
  sheetId?: Identifier;
  gridId?: Identifier;
  rulesOff?: boolean;
}

type ParamName =
  "sharing_offering" |
  "sharing_clazz" |
  "sharing_group" |
  "sheetId" |
  "gridId" |
  "rulesOff";

const params:Params={}
const sharingPrefix = "sharing_";
const listeners:Function[] = [];

const defaultParams = {
  sharing_offering: "default",
  sharing_clazz: "default",
  sharing_group: "default",
  sheetId: "sA38WgGZ",
  gridId: "c23xKskj",
  rulesOff: false
};

export function getParam(name:ParamName) {
  if(params[name] === undefined) {
    return defaultParams[name]
  }
  return params[name];
}

export function updateHash() {
  window.location.hash = `${stringify(params)}`;
  notifyChange();
}

export function setParam(name:ParamName, value:any) {
  params[name] = value;
  updateHash();
}

export function setParams(_newparams:Params) {
  Object.keys(defaultParams).forEach( (key:ParamName) => {
    const useDefault = _newparams[key] === undefined || _newparams[key] === null
    params[key] = useDefault ? defaultParams[key] : _newparams[key];
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
  setParams(parse(window.location.hash));
}

export function paramsFromContext(context:Context) {
  setParams({
    sharing_offering: context.offering.id,
    sharing_group:    context.group.id,
    sharing_clazz:    context.clazz.id
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

