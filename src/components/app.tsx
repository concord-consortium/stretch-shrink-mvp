import * as React from "react"
import { ButtonStrip } from "./button-strip"
import { Spreadsheet, SpreadsheetData } from "./spreadsheet"
import { GeogebraGrid, VisibilityMap } from "./geogebra-grid"
import { assign } from "lodash"

import * as firebase from "firebase"

export interface AppProps {

}

export interface AppState {
  data: SpreadsheetData
  staticData: SpreadsheetData
  startingData: SpreadsheetData
  editable: boolean
  visibilityMap: VisibilityMap
}

export class App extends React.Component<AppProps, AppState> {
  private firebaseRef: firebase.database.Reference
  private cols = 8
  private rows = 8
  private spreadsheetId = "sA38WgGZ"

  constructor(props: AppProps) {
    super(props)
    this.handleReset = this.handleReset.bind(this)
    this.firebaseDataChanged = this.firebaseDataChanged.bind(this)
    this.setCellValue = this.setCellValue.bind(this)
    this.setCellValues = this.setCellValues.bind(this)
    this.toggleVisibility = this.toggleVisibility.bind(this)

    const visibilityMap:VisibilityMap = {}
    for (let col=0; col < this.cols; col++) {
      visibilityMap[col] = true
    }

    this.state = {
      data: {},
      staticData: {},
      startingData: {},
      editable: false,
      visibilityMap: visibilityMap
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
    this.firebaseRef = firebase.database().ref("spreadsheetTestData")
    this.loadGeogebraData(() => {
      this.firebaseRef.on("value", this.firebaseDataChanged)
      this.setState({editable: true})
    })
  }

  componentWillUnmount() {
    this.firebaseRef.off("value", this.firebaseDataChanged)
  }

  loadGeogebraData(callback:Function) {
    // hardcoded for now...
    let startingData:SpreadsheetData = {}
    let staticData:SpreadsheetData = {}
    if (this.spreadsheetId === "sA38WgGZ") {
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
    }
    this.setState({startingData, staticData})
    callback()
  }

  firebaseDataChanged(snapshot:firebase.database.DataSnapshot|null) {
    if (snapshot) {
      let newData = snapshot.val()
      if (newData === null) {
        newData = this.state.startingData
      }
      this.setState({data: assign({}, this.state.staticData, newData)})
    }
  }

  setCellValue(key: string, value:string|null) {
    console.log(key)
    if (this.state.editable && !this.state.staticData[key]) {
      const updates:any = {}
      updates[key] = value
      this.firebaseRef.update(updates)
    }
  }

  setCellValues(updates:any) {
    if (this.state.editable) {
      Object.keys(updates).forEach((key) => {
        if (updates[key] !== this.state.data[key]) {
          const [row, col] = key.split(":")
          if (col === "1") {
            this.transformRow(parseInt(row), updates)
          }
          else {
            //this.updateTranslationRule(parseInt(col), updates)
          }
        }
      })
      this.firebaseRef.update(updates)
    }
  }

  getDilationRules(col:number) {
    let rulePair = this.state.data[`1:${col}`],
        xRegex = /(\-?\d*\.?\d+)x/g,
        yRegex = /(\-?\d*\.?\d+)y/g,
        xMatch = xRegex.exec(rulePair),
        yMatch = yRegex.exec(rulePair),
        xDilation = xMatch ? parseFloat(xMatch[1]) : 1,
        yDilation = yMatch ? parseFloat(yMatch[1]) : 1;

    return [xDilation, yDilation];
  }

  getTranslationRules(col:number) {
    let rulePair = this.state.data[`1:${col}`],
        xRegex = /x\s*(\-|\+)\s*(\d*\.?\d+)/g,
        yRegex = /y\s*(\-|\+)\s*(\d*\.?\d+)/g,
        xMatch = xRegex.exec(rulePair),
        yMatch = yRegex.exec(rulePair),
        // Grab the parsed sign and number for translation rule
        xTranslation = xMatch ? parseFloat(xMatch[1] + xMatch[2]) : 0,
        yTranslation = yMatch ? parseFloat(yMatch[1] + yMatch[2]) : 0;

    return [xTranslation, yTranslation];
  }

  getRowColValue(row:number, col:number, updates:any) {
    let coordRegex = /(\-?\d*\.?\d+),\s*(\-?\d*\.?\d+)/g,
        point = updates[`${row}:${col}`] || this.state.data[`${row}:${col}`],
        matches = coordRegex.exec(point) || [null, null],
        xCoord = matches[1],
        yCoord = matches[2];

    return (xCoord !== null) && (yCoord !== null) ? [parseFloat(xCoord), parseFloat(yCoord)] : null;
  }

  transformRow(row:number, updates:any) {
    for (let col = 2; col < this.cols; col++) {
      let dilationRules = this.getDilationRules(col),
          translationRules = this.getTranslationRules(col),
          baseCoords = this.getRowColValue(row, 1, updates)
      if (baseCoords !== null) {
        let dilatedCoords = [baseCoords[0] * dilationRules[0], baseCoords[1] * dilationRules[1]],
            transformedCoords = [dilatedCoords[0] + translationRules[0], dilatedCoords[1] + translationRules[1]];
        updates[`${row}:${col}`] = `(${transformedCoords[0]}, ${transformedCoords[1]})`
      }
    }
  }

  /*
  updateTranslationRule(col:number, updates:any) {
    const mugCoords =  this.getRowColValue(3, 1, this.state.data)
    const baseCoords = this.getRowColValue(3, col, updates)
    const dilationRules = this.getDilationRules(col)

    if (mugCoords && baseCoords) {
      const newTranslationRules = [mugCoords[0] - baseCoords[0], mugCoords[1] - baseCoords[1]]
      const xTransform = newTranslationRules[0] >= 0 ? dilationRules[0] + "x + " + newTranslationRules[0] : dilationRules[0] + "x - " + Math.abs(newTranslationRules[0])
      const yTransform = newTranslationRules[1] >= 0 ? dilationRules[1] + "y + " + newTranslationRules[1] : dilationRules[1] + "y - " + Math.abs(newTranslationRules[1])

      updates[``]

    sheetApp.setTextValue(col + 2, "(" + xTransform + ", " + yTransform + ")");

    pointNames.forEach(pointName => {
      transformPoint(pointName);
    });

    makeMidpoints();
    saveState();

    restartListeners();


      }

    }
  }
  */

  toggleVisibility(col: number) {
    this.state.visibilityMap[col] = !this.state.visibilityMap[col]
    this.setState({visibilityMap: this.state.visibilityMap})
  }

  handleReset() {
    const data = assign({}, this.state.staticData, this.state.startingData)
    this.firebaseRef.set(data)
  }

  render() {
    return (
      <div>
        <ButtonStrip
          rows={this.rows}
          cols={this.cols}
          data={this.state.data}
          handleReset={this.handleReset}
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
            />
          <GeogebraGrid
            data={this.state.data}
            rows={this.rows}
            cols={this.cols}
            id="c23xKskj"
            setCellValues={this.setCellValues}
            visibilityMap={this.state.visibilityMap}
          />
        </div>
      </div>
    )
  }
}
