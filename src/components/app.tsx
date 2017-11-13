import * as React from "react"
import { ButtonStrip } from "./button-strip"
import { Spreadsheet, SpreadsheetData } from "./spreadsheet"
import { GeogebraGrid, VisibilityMap, ComparisonVisibilityIndex } from "./geogebra-grid"
import { assign, clone } from "lodash"
import { parse, stringify } from "query-string"
import { v1 as uuid  } from "uuid"
import * as queryString from "query-string"
import { SharingClient, SharableApp, Representation, Png, Context, Identifier, SharingParams, SharingParamName, SharingParamDefault, escapeFirebaseKey } from 'cc-sharing'
import { Params, defaultParams, ParamName } from "../params"

declare var gridApp:any

import * as firebase from "firebase"
const domToImage = require("dom-to-image")

export interface AppProps {

}

export interface AppState {
  data: SpreadsheetData
  staticData: SpreadsheetData
  startingData: SpreadsheetData
  editable: boolean
  visibilityMap: VisibilityMap
  startingVisibilityMap: VisibilityMap
  rulesOff: boolean
  sheetId: string
  gridId: string
  sharing_publication: string
  sharing_offering: string
  sharing_class: string
  sharing_group: string
  sharing_id: string
  sharing_clone: string
  ignoreIframe: boolean
}

export class App extends React.Component<AppProps, AppState> {
  private firebaseDataRef: firebase.database.Reference
  private firebaseVisibilityRef: firebase.database.Reference
  private cols = 8
  private rows = 8
  private sharePhone: SharingClient

  constructor(props: AppProps) {
    super(props)
    this.handleReset = this.handleReset.bind(this)
    this.firebaseDataChanged = this.firebaseDataChanged.bind(this)
    this.firebaseVisibilityChanged = this.firebaseVisibilityChanged.bind(this)
    this.setCellValue = this.setCellValue.bind(this)
    this.setCellValues = this.setCellValues.bind(this)
    this.toggleVisibility = this.toggleVisibility.bind(this)

    const visibilityMap:VisibilityMap = {}
    for (let col=0; col < this.cols; col++) {
      visibilityMap[col] = col === ComparisonVisibilityIndex ? false : true
    }

    this.state = {
      data: {},
      staticData: {},
      startingData: {},
      editable: false,
      visibilityMap: visibilityMap,
      startingVisibilityMap: clone(visibilityMap),
      rulesOff: defaultParams.rulesOff,
      gridId: defaultParams.gridId,
      sheetId: defaultParams.sheetId,
      sharing_publication: SharingParamDefault,
      sharing_offering: SharingParamDefault,
      sharing_class: SharingParamDefault,
      sharing_group: SharingParamDefault,
      sharing_id: SharingParamDefault,
      sharing_clone: SharingParamDefault,
      ignoreIframe: false
    }
    firebase.initializeApp({
      apiKey: "AIzaSyC6xLM2k-aYH62O9UeskD-C1OtFtkM58sw",
      authDomain: "stretch-shrink.firebaseapp.com",
      databaseURL: "https://stretch-shrink.firebaseio.com",
      projectId: "stretch-shrink",
      storageBucket: "stretch-shrink.appspot.com",
      messagingSenderId: "616775738467"
    })
  }

  componentWillMount() {
    this.getParams(() => {
      this.checkForCloneOnLoad(() => {
        const baseUrl = this.getBaseUrl()
        this.firebaseDataRef = firebase.database().ref(`${baseUrl}/data`)
        this.firebaseVisibilityRef = firebase.database().ref(`${baseUrl}/visibility`)
        this.loadGeogebraData(() => {
          this.firebaseDataRef.on("value", this.firebaseDataChanged)
          this.firebaseVisibilityRef.on("value", this.firebaseVisibilityChanged)
          this.setState({editable: true})
        })
      })
    })
  }

  componentWillUnmount() {
    this.firebaseDataRef.off("value", this.firebaseDataChanged)
    this.firebaseVisibilityRef.off("value", this.firebaseVisibilityChanged)
  }

  inIframe() {
    try {
      return window.self !== window.top
    } catch (e) {
      return true
    }
  }

  getParams(callback:Function) {
    const params:Params = parse(window.location.hash)
    Object.keys(defaultParams).forEach( (key:ParamName) => {
      if (params[key] === undefined || params[key] === null) {
        params[key] = defaultParams[key]
      }
    })
    params.rulesOff = params.rulesOff === "true"
    params.ignoreIframe = params.ignoreIframe === "true"
    this.setParams(params, () => {
      if (this.inIframe() && !this.state.ignoreIframe && !this.isClone()) {
        this.setupSharing(callback)
      }
      else {
        callback()
      }
    })
  }

  setParams(params:any, callback?:Function) {
    this.setState(params, () => {
      const hashParams = clone(params)
      delete params.ignoreIframe
      window.location.hash = stringify(params)
      if (callback) {
        callback()
      }
    })
  }

  setupSharing(done:Function) {
    const self = this
    let storageRefPath: string

    const paramsWithoutSharing = () => {
      return {
        sheetId: this.state.sheetId,
        gridId: this.state.gridId,
        rulesOff: this.state.rulesOff
      }
    }

    const saveImage = (name: string, base64PNG:string, resolve:Function, reject:Function) => {
      const filename = `${storageRefPath}/${name}.png`
      var storageRef = firebase.storage().ref()
      var fileRef = storageRef.child(filename)
      if (base64PNG) {
        fileRef.putString(base64PNG, 'base64', {contentType:'image/png'}).then((results) => {
          resolve({type: Png, dataUrl: results.downloadURL, name:'stretch and shrink'})
        });
      }
      else {
        reject("Couldn't create firebase file from canvas base64PNG");
      }
    }

    let publishing = false
    const app:SharableApp = {
      application: () => {
        let launchUrl = window.location.href
        if (publishing) {
          // save a copy of the current firebase data into a cloned session
          const publicationId = uuid()
          const publishRef = firebase.database().ref(`publications/${publicationId}`)
          this.cloneData(publishRef)

          // remove all the sharing params and add the publication id
          const params:any = paramsWithoutSharing()
          params.sharing_publication = publicationId
          const a = document.createElement("a")
          a.href = launchUrl
          a.hash = queryString.stringify(params)
          launchUrl = a.toString()

          publishing = false
        }
        return {
          launchUrl: launchUrl,
          name: "MugWumps"
        }
      },

      getDataFunc: (context:Context|null) => {
        publishing = true

        const gridPromise = new Promise<Representation>((resolve, reject) => {
          gridApp.getScreenshotBase64((base64PNG:string) => {
            saveImage("grid", base64PNG, resolve, reject)
          })
        })

        const sheetPromise = new Promise<Representation>((resolve, reject) => {
          self.getSpreadsheetImage((base64PNG:string) => {
            saveImage("spreadsheet", base64PNG, resolve, reject)
          })
        })

        return Promise.all([gridPromise, sheetPromise]);
      },

      initCallback: (context:Context) => {
        storageRefPath = `thumbnails/${escapeFirebaseKey(context.offering)}/${escapeFirebaseKey(context.group)}/${escapeFirebaseKey(context.class)}/${escapeFirebaseKey(context.id)}`
        self.setParams({
          sharing_id:       context.id as string,
          sharing_offering: context.offering as string,
          sharing_group:    context.group as string,
          sharing_class:    context.class as string
        }, done)
      }
    }

    this.sharePhone = new SharingClient({app})
  }

  getSpreadsheetImage(callback:(image:string) => void) {
    const spreadsheet = document.getElementById("spreadsheet")
    if (spreadsheet) {
      const options = {
        width: spreadsheet.clientWidth,
        height: spreadsheet.clientHeight
      }
      domToImage
        .toPng(spreadsheet)
        .then((dataUrl:string) => {
          callback(dataUrl.replace(/^data:image\/png;base64,/, ""))
        })
        .catch((error:any) => {
          callback("")
        });
    }
    else {
      callback("")
    }
  }

  isClone() {
    return this.state.sharing_clone !== SharingParamDefault
  }

  isPublication() {
    return this.state.sharing_publication !== SharingParamDefault
  }

  checkForCloneOnLoad(callback:Function) {
    if (this.isClone()) {
      const cloneRef = firebase.database().ref(this.getCloneUrl());
      cloneRef.once("value", (cloneSnapshot) => {
        if (!cloneSnapshot.val()) {
          // clone has no value so copy the base data into it
          this.cloneData(cloneRef, callback);
        }
        else {
          callback();
        }
      });
    }
    else {
      callback();
    }
  }

  cloneData(cloneRef:firebase.database.Reference, callback?:Function) {
    const baseRef = firebase.database().ref(this.getBaseUrl(true));
    baseRef.once("value", (baseSnapshot) => {
      const data = baseSnapshot.val();
      cloneRef.set(data);
      if (callback) {
        callback();
      }
    });
  }

  getBaseUrl(forceNonCloneUrl?:boolean) {
    const offeringId = escapeFirebaseKey(this.state.sharing_offering),
          groupId = escapeFirebaseKey(this.state.sharing_group),
          itemId = escapeFirebaseKey(this.state.sharing_id),
          classId = escapeFirebaseKey(this.state.sharing_class)

    if (!this.isClone() || forceNonCloneUrl) {
      if (this.isPublication()) {
        return `publications/${this.state.sharing_publication}`
      }
      const baseUrl = `classes/${classId}/groups/${groupId}/offerings/${offeringId}/items/${itemId}/sheet/${this.state.sheetId}/grid/${this.state.gridId}`
      //console.log("Mugwumps BaseUrl:", baseUrl);
      return baseUrl
    }
    return this.getCloneUrl()
  }

  getCloneUrl() {
    return `clones/${this.state.sharing_clone}`;
  }

  loadGeogebraData(callback:Function) {
    // hardcoded for now...
    let startingData:SpreadsheetData = {}
    let staticData:SpreadsheetData = {}
    switch (this.state.sheetId) {
      case "EW26mQ35":
        staticData = {
          "0:0": "",
          "0:1": "Mug's Hat",
          "0:2": "Hat 1",
          "0:3": "Hat 2",
          "0:4": "Hat 3",
          "0:5": "Hat 4",
          "0:6": "Hat 5",
          "0:7": "Hat 6",
          "1:0": "",
          "2:0": "A",
          "3:0": "B",
          "4:0": "C",
          "5:0": "D",
          "6:0": "E",
          "7:0": "F"
        }
        startingData = {
          "1:1": "(x,y)",
          "1:2": "(x+2,y+3)",
          "1:3": "(x-1,y+4)",
          "1:4": "(x+2,3y)",
          "1:5": "(.5x,.5y)",
          "1:6": "(2x,3y)",
          "1:7": "(x,y)",
          "2:1": "(1,1)",
          "3:1": "(9,1)",
          "4:1": "(6,2)",
          "5:1": "(6,3)",
          "6:1": "(4,3)",
          "7:1": "(4,2)",
        }
        break
      case "fVtztHNs":
        staticData = {
          "0:0": "",
          "0:1": "Mug's Hat",
          "0:2": "Hat 7",
          "0:3": "Hat 8",
          "0:4": "Hat 9",
          "0:5": "Hat 10",
          "0:6": "Hat 11",
          "0:7": "Hat 12",
          "1:0": "",
          "2:0": "A",
          "3:0": "B",
          "4:0": "C",
          "5:0": "D",
          "6:0": "E",
          "7:0": "F"
        }
        startingData = {
          "1:1": "(x,y)",
          "1:2": "(x,y)",
          "1:3": "(x,y)",
          "1:4": "(x,y)",
          "1:5": "(x,y)",
          "1:6": "(x,y)",
          "1:7": "(x,y)",
          "2:1": "(1,1)",
          "3:1": "(9,1)",
          "4:1": "(6,2)",
          "5:1": "(6,3)",
          "6:1": "(4,3)",
          "7:1": "(4,2)",
        }
        break;
      case "QtN5E2q4":
        staticData = {
          "0:0": "",
          "0:1": "Mug's Hat",
          "0:2": "Mug's New Hat",
          "1:0": "",
          "2:0": "A",
          "3:0": "B",
          "4:0": "C",
          "5:0": "D",
          "6:0": "E",
          "7:0": "F"
        }
        startingData = {
          "1:1": "(x,y)",
          "1:2": "(x,y)",
          "2:1": "(1,1)",
          "3:1": "(9,1)",
          "4:1": "(6,2)",
          "5:1": "(6,3)",
          "6:1": "(4,3)",
          "7:1": "(4,2)",
        }
        break;
    }
    this.setState({startingData, staticData})
    callback()
  }

  firebaseDataChanged(snapshot:firebase.database.DataSnapshot|null) {
    if (snapshot) {
      let newData = snapshot.val()
      if (newData === null) {
        this.firebaseDataRef.set(assign({}, this.state.staticData, this.state.startingData))
      }
      else {
        this.setState({data: assign({}, this.state.staticData, newData)})
      }
    }
  }

  firebaseVisibilityChanged(snapshot:firebase.database.DataSnapshot|null) {
    if (snapshot) {
      let newVisibilityMap = snapshot.val()
      if (newVisibilityMap === null) {
        this.firebaseVisibilityRef.set(this.state.startingVisibilityMap)
      }
      else {
        this.setState({visibilityMap: newVisibilityMap})
      }
    }
  }

  setCellValue(key: string, value:string|null, ignoreSideEffects:boolean=false) {
    if (this.state.editable && !this.state.staticData[key]) {
      const updates:any = {}
      updates[key] = value
      if (!this.state.rulesOff) {
        this.checkUpdateForSideEffects(key, updates)
      }
      this.firebaseDataRef.update(updates)
    }
  }

  setCellValues(updates:any) {
    if (this.state.editable) {
      if (!this.state.rulesOff) {
        Object.keys(updates).forEach((key) => {
          this.checkUpdateForSideEffects(key, updates)
        })
      }
      this.firebaseDataRef.update(updates)
    }
  }

  checkUpdateForSideEffects(key: string, updates:any) {
    if (updates[key] !== this.state.data[key]) {
      const [row, col] = key.split(":")
      if (row === "1") {
        this.applyRuleToUpdate(parseInt(col), updates)
      }
      else if (col === "1") {
        this.transformRow(parseInt(row), updates)
      }
    }
  }

  hasRules(col:number, updates:any={}) {
    let key = `1:${col}`,
        rulePair = updates[key] || this.state.data[key] || ""
    return rulePair.replace(/\s/, "").length > 0
  }

  getDilationRules(col:number, updates:any={}) {
    let key = `1:${col}`,
        rulePair = updates[key] || this.state.data[key],
        xRegex = /(\-?\d*\.?\d+)x/g,
        yRegex = /(\-?\d*\.?\d+)y/g,
        xMatch = xRegex.exec(rulePair),
        yMatch = yRegex.exec(rulePair),
        x = xMatch ? parseFloat(xMatch[1]) : 1,
        y = yMatch ? parseFloat(yMatch[1]) : 1;

    return {x, y}
  }

  getTranslationRules(col:number, updates:any={}) {
    let key = `1:${col}`,
        rulePair = updates[key] || this.state.data[key],
        xRegex = /x\s*(\-|\+)\s*(\d*\.?\d+)/g,
        yRegex = /y\s*(\-|\+)\s*(\d*\.?\d+)/g,
        xMatch = xRegex.exec(rulePair),
        yMatch = yRegex.exec(rulePair),
        // Grab the parsed sign and number for translation rule
        x = xMatch ? parseFloat(xMatch[1] + xMatch[2]) : 0,
        y = yMatch ? parseFloat(yMatch[1] + yMatch[2]) : 0;

    return {x, y}
  }

  getRowColValue(row:number, col:number, updates:any={}) {
    let coordRegex = /(\-?\d*\.?\d+),\s*(\-?\d*\.?\d+)/g,
        point = updates[`${row}:${col}`] || this.state.data[`${row}:${col}`],
        matches = coordRegex.exec(point) || [null, null],
        xCoord = matches[1],
        yCoord = matches[2];

    return (xCoord !== null) && (yCoord !== null) ? {x: parseFloat(xCoord), y: parseFloat(yCoord)} : null;
  }

  transformRow(row:number, updates:any) {
    for (let col = 2; col < this.cols; col++) {
      let hasRules = this.hasRules(col),
          dilationRules = this.getDilationRules(col),
          translationRules = this.getTranslationRules(col),
          baseCoords = this.getRowColValue(row, 1, updates)
      if (hasRules && (baseCoords !== null)) {
        let dilatedCoords = {x: baseCoords.x * dilationRules.x, y: baseCoords.y * dilationRules.y},
            transformedCoords = {x: dilatedCoords.x + translationRules.x, y: dilatedCoords.y + translationRules.y};
        updates[`${row}:${col}`] = `(${this.round(transformedCoords.x)}, ${this.round(transformedCoords.y)})`
      }
    }
  }

  round(n:number) {
    return Math.round(n * 100) / 100
  }

  applyRuleToUpdate(col:number, updates:any) {
    const dialation = this.getDilationRules(col, updates)
    const translation = this.getTranslationRules(col, updates)

    for (let row = 2; row < this.rows; row++) {
      const hat = this.getRowColValue(row, 1)
      if (hat) {
        const newX = this.round((hat.x * dialation.x) + translation.x)
        const newY = this.round((hat.y * dialation.y) + translation.y)
        updates[`${row}:${col}`] = `(${newX},${newY})`
      }
    }
  }

  toggleVisibility(col: number) {
    this.state.visibilityMap[col] = !this.state.visibilityMap[col]
    //this.setState({visibilityMap: this.state.visibilityMap})
    this.firebaseVisibilityRef.set(this.state.visibilityMap)
  }

  handleReset() {
    const data = assign({}, this.state.staticData, this.state.startingData)
    this.firebaseDataRef.set(data)
    this.firebaseVisibilityRef.set(this.state.startingVisibilityMap)
  }

  render() {
    return (
      <div>
        <ButtonStrip
          rows={this.rows}
          cols={this.cols}
          data={this.state.data}
          handleReset={this.handleReset}
          visibilityMap={this.state.visibilityMap}
          toggleVisibility={this.toggleVisibility}
        />
        <div id="appContainer">
          <Spreadsheet
              rows={this.rows}
              cols={this.cols}
              editable={this.state.editable}
              data={this.state.data}
              staticData={this.state.staticData}
              startingData={this.state.startingData}
              setCellValue={this.setCellValue}
              rulesOff={this.state.rulesOff}
            />
          <GeogebraGrid
            data={this.state.data}
            rows={this.rows}
            cols={this.cols}
            id={this.state.gridId}
            setCellValues={this.setCellValues}
            visibilityMap={this.state.visibilityMap}
            rulesOff={this.state.rulesOff}
          />
        </div>
      </div>
    )
  }
}
