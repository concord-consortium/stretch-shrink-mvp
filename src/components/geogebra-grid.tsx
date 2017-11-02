import * as React from "react"
import { SpreadsheetData, getColColor } from "./spreadsheet"
import { debounce } from "lodash"

declare var GGBApplet:any
declare var gridApp:any

export interface GeogebraGridProps {
  id: string
  rows: number
  cols: number
  data: SpreadsheetData
  setCellValues: (updates:any) => void
  visibilityMap: VisibilityMap
}

export interface GeogebraGridState {
  inited: boolean
}

export interface VisibilityMap {
  [key: number]: boolean
}

export interface Point {
  name: string,
  x: string
  y: string
  row: number
  col: number
}

export interface Poly {
  name: string
  points: Point[]
}

export interface PointMap {
  [key: string]: Point
}

export interface PolyMap {
  [key: string]: Poly
}

export class GeogebraGrid extends React.Component<GeogebraGridProps, GeogebraGridState> {
  private applet:any
  private pointMap:PointMap = {}
  private polyMap:PolyMap = {}
  private ignoreUpdates = false
  private updateTimeout: number

  constructor(props: GeogebraGridProps) {
    super(props)
    this.updateListener = this.updateListener.bind(this)
    this.removeListener = this.removeListener.bind(this)

    this.state = {
      inited: false
    }

    const win = (window as any)
    win.ggbOnInit = this.ggbOnInit.bind(this)
  }

  componentDidMount() {
    const parameters = {
      "id": "gridApp",
      "width":900,
      "height":750,
      "showMenuBar":false,
      "showAlgebraInput":false,
      "showToolBar":true,
      "showToolBarHelp":false,
      "showResetIcon":false,
      "enableLabelDrags":false,
      "enableShiftDragZoom":true,
      "enableRightClick":true,
      "errorDialogsActive":false,
      "useBrowserForJS":true,
      "preventFocus":false,
      "language":"en",
      "material_id": this.props.id
    }
    // is3D=is 3D applet using 3D view, AV=Algebra View, SV=Spreadsheet View, CV=CAS View, EV2=Graphics View 2, CP=Construction Protocol, PC=Probability Calculator, DA=Data Analysis, FI=Function Inspector, PV=Python, macro=Macro View
    const views = {'is3D': 0,'AV': 1,'SV': 1,'CV': 0,'EV2': 0,'CP': 0,'PC': 0,'DA': 0,'FI': 0,'PV': 0,'macro': 0};
    this.applet = new GGBApplet(parameters, '5.0', views);
    this.applet.inject('gridApp')
  }

  shouldComponentUpdate() {
    return false
  }

  componentWillReceiveProps(nextProps:GeogebraGridProps) {
    this.drawPolygons(nextProps.data, nextProps.visibilityMap)
  }

  // automatically called by Geogebra when the applet inits
  ggbOnInit() {
    this.setState({inited: true}, () => {
      this.drawPolygons(this.props.data, this.props.visibilityMap)
      gridApp.registerUpdateListener(this.updateListener)
      gridApp.registerRemoveListener(this.removeListener)
    })
  }

  getPointFromCell(data:SpreadsheetData, name: string, row: number, col: number):Point|null {
    let coordRegex = /(\-?\d*\.?\d+),\s*(\-?\d*\.?\d+)/g,
        point = data[this.getCellKey(row, col)],
        matches = coordRegex.exec(point) || [null, null],
        x = matches[1],
        y = matches[2];

    if ((x !== null) && (y !== null)) {
      return {name, x, y, row, col}
    }
    return null
  }

  getCellKey(row: number, col: number) {
    return `${row}:${col}`
  }

  drawPolygons(data:SpreadsheetData, visibilityMap:VisibilityMap) {
    if (!this.state.inited) {
      return
    }

    this.polyMap = {}
    this.pointMap = {}
    let pointSuffix = ""
    for (let col = 1; col < this.props.cols; col++) {
      let pointName = "A"
      const points:Point[] = []
      for (let row = 2; row < this.props.rows; row++) {
        let point = this.getPointFromCell(data, pointName + pointSuffix, row, col)
        if (point) {
          points.push(point)
          this.pointMap[point.name] = point
        }
        pointName = String.fromCharCode(pointName.charCodeAt(0) + 1)
      }

      const polyName = `Poly${pointSuffix}`
      if (points.length > 0) {
        points.forEach((point) => {
          gridApp.evalCommand(`${point.name} = (${point.x},${point.y})`)
          gridApp.setLabelVisible(point.name, true)
          gridApp.setVisible(point.name, this.props.visibilityMap[col])
        })
        const polyPoints = points.map((point) => point.name).join(",")
        const polyColor = getColColor(col)
        gridApp.evalCommand(`${polyName} = Polygon(${polyPoints})`)
        gridApp.setColor(polyName, polyColor.r, polyColor.g, polyColor.b)
        gridApp.setVisible(polyName, this.props.visibilityMap[col])
        this.polyMap[polyName] = {name: polyName, points}
      }
      else {
        gridApp.deleteObject(polyName)
        let pointName = "A"
        for (let row = 2; row < this.props.rows; row++) {
          gridApp.deleteObject(`${pointName}${pointSuffix}`)
          pointName = String.fromCharCode(pointName.charCodeAt(0) + 1)
        }
      }

      pointSuffix += "'"
    }
  }

  round(n:number) {
    return Math.round(n * 100) / 100
  }

  updateListener(objName:string) {
    const poly = this.polyMap[objName]
    if (poly && !this.ignoreUpdates) {
      clearTimeout(this.updateTimeout)
      this.updateTimeout = setTimeout(() => {
        this.ignoreUpdates = true
        const updates:any = {}
        poly.points.forEach((point) => {
          let [x, y] = [gridApp.getXcoord(point.name), gridApp.getYcoord(point.name)]
          updates[this.getCellKey(point.row, point.col)] = `(${this.round(x)},${this.round(y)})`
        })
        this.props.setCellValues(updates)
        this.ignoreUpdates = false
      }, 250) as any
    }
  }

  removeListener(objName:string) {
    const point = this.pointMap[objName]
    if (point) {
      const updates:any = {}
      updates[this.getCellKey(point.row, point.col)] = null
      this.props.setCellValues(updates)
    }
  }

  render() {
    return <div id="gridApp"></div>
  }
}
