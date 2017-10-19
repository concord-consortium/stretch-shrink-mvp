import { Context, Identifier, SharingParams, SharingParamName, SharingParamDefault } from 'cc-sharing';
import { parse, stringify } from "query-string";
import { isEqual, clone } from "lodash";

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
  sharing_publication: SharingParamDefault,
  sharing_offering: SharingParamDefault,
  sharing_class: SharingParamDefault,
  sharing_group: SharingParamDefault,
  sharing_clone: SharingParamDefault,
  sheetId: "sA38WgGZ",
  gridId: "c23xKskj",
  rulesOff: false
};

export function paramsWithoutSharing() {
  const p:any = {};
  Object.keys(params).forEach((key) => {
    if (!key.match(/sharing_/)) {
      p[key] = (params as any)[key]
    }
  })
  return p
}

export function getParam(name:ParamName, _default:string="") {
  return params[name] || defaultParams[name] || _default;
}

export function updateHash(via:string) {
  window.location.hash = `${stringify(params)}`;
  notifyChange(via);
}

export function setParam(name:ParamName, value:any) {
  params[name] = value;
  updateHash("setParam");
}

export function setParamsWithDefaults(_newparams:Params, via:string, skipUpdateHash:boolean = false) {
  Object.keys(defaultParams).forEach( (key:ParamName) => {
    const useDefault = _newparams[key] === undefined || _newparams[key] === null
    params[key] = useDefault ? defaultParams[key] : _newparams[key];
  });
  if (!skipUpdateHash) {
    updateHash(via);
  }
}


export function setParams(_newparams:Params, via:string) {
  Object.keys(_newparams).forEach( (key:ParamName) => {
    params[key] = _newparams[key];
  });
  updateHash(via);
}

export function addParamChangeListener(callbackF:Function) {
  listeners.push(callbackF);
}

function notifyChange(via:string) {
  listeners.forEach( (listener:Function) => listener(via));
}

export function paramsFromContext(context:Context, via:string) {
  setParams({
    sharing_offering: context.offering,
    sharing_group:    context.group,
    sharing_class:    context.class
  }, via)
}

function paramsFromAddress(via:string, skipUpdateHash:boolean = false) {
  if(! isEqual(params, parse(window.location.hash))) {
    setParamsWithDefaults(parse(window.location.hash), via, skipUpdateHash);
  }
}

// load from params if not in iframe
const skipUpdateHash = window.top !== window.self;
paramsFromAddress("direct call", skipUpdateHash);

//window.addEventListener("onLoad", () => paramsFromAddress("onLoad"));
//window.addEventListener("hashchange", () => paramsFromAddress("hashchange"), false);
