import * as React from "react"
import { SpreadsheetData, getColRGB } from "./spreadsheet"
import { VisibilityMap, ComparisonVisibilityIndex } from "./geogebra-grid"

export interface ButtonStripProps {
  rows: number
  cols: number
  handleReset: () => void
  data: SpreadsheetData
  toggleVisibility: (col: number) => void
  visibilityMap: VisibilityMap
}

export interface ButtonStripState {

}

export class ButtonStrip extends React.Component<ButtonStripProps, ButtonStripState> {
  constructor(props: ButtonStripProps) {
    super(props)
    this.handleReset = this.handleReset.bind(this)
    this.state = {
    }
  }

  handleReset() {
    this.props.handleReset()
  }

  getCellKey(row: number, col: number) {
    return `${row}:${col}`
  }

  renderButton(col:number, visible:boolean, enabled:boolean) {
    const style = {color: getColRGB(col)}
    const clicked = () => {
      this.props.toggleVisibility(col)
    }
    const prefix = visible ? "Hide" : "Unhide"
    return <button key={col} disabled={!enabled} style={style} onClick={clicked}>{prefix} Hat {col - 1}</button>
  }

  renderComparisonButton() {
    const visible = this.props.visibilityMap[ComparisonVisibilityIndex]
    const prefix = visible ? "Hide" : "Unhide"
    const clicked = () => {
      this.props.toggleVisibility(0)
    }
    return <button id="toggle-compare" onClick={clicked}>{prefix} Comparison Mug</button>
  }

  renderVisibilityButtons() {
    const buttons:JSX.Element[] = []
    for (let col = 2; col < this.props.cols; col++) {
      let enabled = false
      for (let row = 2; row < this.props.rows; row++) {
        if (!enabled) {
          const value = this.props.data[this.getCellKey(row, col)]
          enabled = typeof value !== undefined
        }
      }
      buttons.push(this.renderButton(col, this.props.visibilityMap[col], enabled))
    }
    return <div id="visiblity-buttons">{buttons}</div>
  }

  render() {
    return (
      <div id="buttons">
        {this.renderComparisonButton()}
        {this.renderVisibilityButtons()}
        <button id="reset" onClick={this.handleReset}>Reset</button>
      </div>
    )
  }
}
