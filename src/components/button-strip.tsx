import * as React from "react"
import { SpreadsheetData, getColRGB } from "./spreadsheet"

export interface ButtonStripProps {
  rows: number
  cols: number
  handleReset: () => void
  data: SpreadsheetData
  toggleVisibility: (col: number) => void
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

  renderButton(col:number, enabled:boolean) {
    const style = {color: getColRGB(col)}
    const clicked = () => {
      this.props.toggleVisibility(col)
    }
    return <button key={col} disabled={!enabled} style={style} onClick={clicked}>Hide/Unhide Hat {col - 1}</button>
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
      buttons.push(this.renderButton(col, enabled))
    }
    return <div id="visiblity-buttons">{buttons}</div>
  }

  render() {
    return (
      <div id="buttons">
        <button id="toggle-compare" style={{color: "red"}}>Toggle Comparison Mug</button>
        {this.renderVisibilityButtons()}
        <button id="reset" onClick={this.handleReset}>Reset</button>
      </div>
    )
  }
}
