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
  rulesOff: boolean
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

    gridApp.unregisterUpdateListener(this.updateListener)
    gridApp.unregisterRemoveListener(this.removeListener)

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

    this.makeMidpoints()

    gridApp.registerUpdateListener(this.updateListener)
    gridApp.registerRemoveListener(this.removeListener)
  }

  getMaxCoords(pointSuffix="") {
    let maxX = 0
    let maxY = 0

    const poly = this.polyMap[`Poly${pointSuffix}`]
    if (poly) {
      poly.points.forEach((point) => {
        maxX = Math.max(maxX, gridApp.getXcoord(point.name))
        maxY = Math.max(maxY, gridApp.getYcoord(point.name))
      })
    }

    return {maxX, maxY}
  }

  getDilationRules(col:number) {
    let rulePair = this.props.data[`1:${col}`],
        xRegex = /(\-?\d*\.?\d+)x/g,
        yRegex = /(\-?\d*\.?\d+)y/g,
        xMatch = xRegex.exec(rulePair),
        yMatch = yRegex.exec(rulePair),
        xDilation = xMatch ? parseFloat(xMatch[1]) : 1,
        yDilation = yMatch ? parseFloat(yMatch[1]) : 1;

    return {xDilation, yDilation};
  }

  makeMidpoints() {
    if (this.props.rulesOff) {
      return
    }

    let {maxX, maxY} = this.getMaxCoords("'")

    gridApp.evalCommand("X_MID = (" + maxX/2 + ", " + maxY + ")");
    gridApp.evalCommand("X_ZERO = (" + 0 + ", " + maxY + ")");
    gridApp.evalCommand("Y_MID = (" + maxX + ", " + maxY/2 + ")");
    gridApp.evalCommand("Y_ZERO = (" + maxX + ", " + 0 + ")");
    gridApp.evalCommand("XY_MAX = (" + maxX + ", " + maxY + ")");

    gridApp.setColor("X_MID", 255, 0, 0);
    gridApp.setColor("Y_MID", 255, 0, 0);
    gridApp.setColor("XY_MAX", 255, 0, 0);
    gridApp.setVisible("X_ZERO", false);
    gridApp.setVisible("Y_ZERO", false);

    gridApp.evalCommand("TOP_SEG = Segment(X_ZERO, XY_MAX)");
    gridApp.evalCommand("RIGHT_SEG = Segment(Y_ZERO, XY_MAX)");
    gridApp.setLineStyle("TOP_SEG", 1);
    gridApp.setLineStyle("RIGHT_SEG", 1);
  }

  firstHatExists() {
    return !!(this.polyMap["Poly'"] && (this.polyMap["Poly'"].points.length > 2))
  }

  handleYMidPoint() {
    if (this.firstHatExists()) {
      let newX = gridApp.getXcoord("Y_MID")
      let baseX = this.getMaxCoords().maxX
      let newXDilation = Math.round(newX / baseX * 100) / 100
      let yDilation = this.getDilationRules(2).yDilation
      let rule = `(${newXDilation}x, ${yDilation}y)`
      this.props.setCellValues({"1:2": rule})
    }
  }

  handleXMidPoint() {
    if (this.firstHatExists()) {
      let newY = gridApp.getYcoord("X_MID")
      let baseY = this.getMaxCoords().maxY
      let newYDilation = Math.round(newY / baseY * 100) / 100
      let xDilation = this.getDilationRules(2).xDilation
      let rule = `(${xDilation}x, ${newYDilation}y)`
      this.props.setCellValues({"1:2": rule})
    }
  }

  handleXYMaxPoint() {
    if (this.firstHatExists()) {
      let dilation = this.getDilationRules(2)
      let newX = gridApp.getXcoord("XY_MAX")
      let base = this.getMaxCoords()
      let scaleFactor = (newX / base.maxX) / dilation.xDilation
      let xDilation =  Math.round((dilation.xDilation * scaleFactor) * 100) / 100
      let yDilation = Math.round((dilation.yDilation * scaleFactor) * 100) / 100

      let rule = `(${xDilation}x, ${yDilation}y)`
      this.props.setCellValues({"1:2": rule})
    }
  }

  round(n:number) {
    return Math.round(n * 100) / 100
  }

  updateListener(objName:string) {
    switch (objName) {
      case "Y_MID":
        this.handleYMidPoint()
        break
      case "X_MID":
        this.handleXMidPoint()
        break
      case "XY_MAX":
        this.handleXYMaxPoint()
        break

      default:
        // update polygon in sheet
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
        break
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
