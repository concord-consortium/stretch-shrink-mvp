import * as React from "react"
import * as ReactDOM from "react-dom"
import * as firebase from "firebase"

export interface SpreadsheetData {
  [key: string]: string
}

export interface CellAddress {
  row: number
  col: number
}

export interface SpreadsheetCellProps {
  value: string
  cell: CellAddress
  currentCell: CellAddress
  editingCell: CellAddress|null
  editSelectAll: boolean
  setCurrentCell: (cell:CellAddress) => void
  setEditingCell: (cell:CellAddress|null) => void
  setCellValue: (cell: CellAddress, value:string) => void
  move: (deltaRow:number, deltaCol:number, edit?:boolean) => void
}

export interface SpreadsheetCellState {
  value: string,
  editValue: string
}

export interface Color {
  r: number
  g: number
  b: number
}

const colColors:Color[] = [
  {r: 0, g: 0, b: 0},
  {r: 255, g:   0, b:   0},
  {r:   0, g:   0, b: 255},
  {r: 255, g: 127, b:   0},
  {r: 255, g:   0, b: 255},
  {r:   0, g: 204, b:   0},
  {r: 153, g: 102, b: 255},
  {r: 153, g: 204, b: 255}
]

export function getColColor(col:number) {
  return colColors[col] || colColors[0]
}
export function getColRGB(col:number) {
  const color = getColColor(col)
  return `rgb(${color.r}, ${color.g}, ${color.b})`
}

export class SpreadsheetCell extends React.Component<SpreadsheetCellProps, SpreadsheetCellState> {
  private lastClick:number = 0

  constructor(props: SpreadsheetCellProps) {
    super(props)
    this.clicked = this.clicked.bind(this)
    this.changed = this.changed.bind(this)
    this.keyDown = this.keyDown.bind(this)
    this.state = {
      value: this.props.value,
      editValue: this.props.value
    }
  }

  refs: {
    input: HTMLInputElement
  }

  componentWillReceiveProps(nextProps:SpreadsheetCellProps) {
    if (nextProps.value !== this.props.value) {
      this.setState({value: nextProps.value, editValue: nextProps.value})
    }
  }

  componentDidUpdate(prevProps:SpreadsheetCellProps) {
    const {input} = this.refs
    if (input) {
      const wasEditingCell = this.isSameCell(prevProps.cell, prevProps.editingCell)
      const isEditingCell = this.isSameCell(this.props.cell, this.props.editingCell)
      if (isEditingCell && !wasEditingCell) {
        input.focus()
        if (this.props.editSelectAll) {
          input.select()
        }
        else {
          input.selectionStart = input.selectionEnd = input.value.length
        }
      }
    }
  }

  clicked() {
    const now = (new Date()).getTime()
    this.props.setCurrentCell(this.props.cell)
    if (now - this.lastClick <= 250) {
      this.props.setEditingCell(this.props.cell)
    }
    this.lastClick = now
  }

  isSameCell(cell1:CellAddress|null, cell2:CellAddress|null) {
    return cell1 && cell2 && (cell1.row === cell2.row) && (cell1.col === cell2.col)
  }

  changed() {
    this.setState({editValue: this.refs.input.value})
  }

  keyDown(e:React.KeyboardEvent<HTMLInputElement>) {
    const isTab = e.keyCode === 9
    const isEnter = e.keyCode === 13
    const isEscape = e.keyCode === 27
    const isLeftArrow = e.keyCode === 37
    const isRightArrow = e.keyCode === 39
    const isUpArrow = e.keyCode === 38
    const isDownArrow = e.keyCode === 40

    if (isTab || isEnter || isEscape || isLeftArrow || isRightArrow || isUpArrow || isDownArrow) {
      const {input} = this.refs
      if ((isLeftArrow && (input.selectionStart > 0)) || (isRightArrow && (input.selectionEnd < input.value.length))) {
        return
      }
      e.preventDefault()
      e.stopPropagation()
      if (isEscape) {
        this.setState({editValue: this.state.value})
        this.props.setEditingCell(null)
      }
      else {
        const deltaRow = isTab || isLeftArrow || isRightArrow ? 0 : (isUpArrow ? -1 : 1)
        const deltaCol = isTab ? (e.shiftKey ? -1 : 1) : (isLeftArrow ? -1 : (isRightArrow ? 1 : 0))
        this.setState({value: this.state.editValue})
        this.props.setCellValue(this.props.cell, this.state.editValue)
        this.props.move(deltaRow, deltaCol, !isLeftArrow && !isRightArrow)
      }
    }
  }

  render() {
    const isEditingCell = this.isSameCell(this.props.cell, this.props.editingCell)
    if (isEditingCell) {
      return <td className="editing-cell"><input ref="input" value={this.state.editValue} onChange={this.changed} onKeyDown={this.keyDown}/></td>
    }
    const value = this.state.value.trim().length === 0 ? " " : this.state.value
    const isCurrentCell = this.isSameCell(this.props.cell, this.props.currentCell)
    const color = getColRGB(this.props.cell.col)
    return <td className={isCurrentCell ? "current-cell" : ""} onClick={this.clicked} title={value} style={{color}}>{value}</td>
  }
}

export interface SpreadsheetProps {
  rows: number
  cols: number
  data: SpreadsheetData
  staticData: SpreadsheetData
  startingData: SpreadsheetData
  editable: boolean
  rulesOff: boolean
  setCellValue: (key: string, value: string|null) => void
}

export interface SpreadsheetState {
  currentCell: CellAddress
  editingCell: CellAddress|null
  editSelectAll: boolean
  loadedGeogebraData: boolean
}

export class Spreadsheet extends React.Component<SpreadsheetProps, SpreadsheetState> {
  constructor(props: SpreadsheetProps) {
    super(props)
    this.keydown = this.keydown.bind(this)
    this.paste = this.paste.bind(this)
    this.setCurrentCell = this.setCurrentCell.bind(this)
    this.setEditingCell = this.setEditingCell.bind(this)
    this.setCellValue = this.setCellValue.bind(this)
    this.move = this.move.bind(this)
    this.state = {
      currentCell: {row: 0, col: 0},
      editingCell: null,
      editSelectAll: true,
      loadedGeogebraData: false
    }
  }

  componentWillMount() {
    window.addEventListener("keydown", this.keydown)
    document.addEventListener('paste', this.paste);
  }

  componentWillUnmount() {
    window.removeEventListener("keydown", this.keydown)
  }


  move(deltaRow:number, deltaCol:number, edit?:boolean) {
    const cell = {row: this.state.currentCell.row + deltaRow, col: this.state.currentCell.col + deltaCol}
    if ((cell.row >= 0) && (cell.row < this.props.rows) && (cell.col >= 0) && (cell.col < this.props.cols)) {
      this.setState({currentCell: cell, editingCell: edit ? cell : null, editSelectAll: true})
    }
  }

  keydown(e:KeyboardEvent) {
    if (this.state.editingCell || e.ctrlKey) {
      return
    }
    const {currentCell} = this.state
    e.preventDefault()
    e.stopPropagation()
    switch (e.keyCode) {
      case 37: this.move(0, -1); break; // left arrow
      case 38: this.move(-1, 0); break; // up arrow
      case 9:  this.move(0, e.shiftKey ? -1 : 1); break; //tab
      case 39: this.move(0, 1); break; // right arrow
      case 40: this.move(1, 0); break; // down arrow
      case 35: // end
        this.setState({currentCell: {row: this.state.currentCell.row, col: this.props.cols - 1}})
        break
      case 36: // home
        this.setState({currentCell: {row: this.state.currentCell.row, col: 0}})
        break
      case 8: // delete
      case 46: // backspace
        this.setCellValue(currentCell, "")
        break
      case 13: // enter
      case 113: // F2
        this.setEditingCell(currentCell, true);
        break
      case 27: this.setEditingCell(null); break;
      default:
        if (e.key.length === 1) { // to avoid command keys
          this.setCellValue(currentCell, e.key)
          this.setEditingCell(currentCell)
        }
        break;
    }
  }

  paste(e:ClipboardEvent) {
    const clipText = e.clipboardData.getData('Text')
    if (clipText.length > 0) {
      const {currentCell} = this.state
      this.setCellValue(currentCell, clipText)
      this.setEditingCell(currentCell)
    }
  }

  setCurrentCell(cell: CellAddress) {
    this.setState({currentCell: cell, editingCell: null})
  }

  setEditingCell(cell: CellAddress|null, editSelectAll:boolean=false) {
    if (cell && this.props.staticData.hasOwnProperty(this.getCellKey(cell))) {
      cell = null
    }
    this.setState({editingCell: cell, editSelectAll})
  }

  getCellKey(cell: CellAddress) {
    return `${cell.row}:${cell.col}`
  }

  setCellValue(cell: CellAddress, value:string) {
    this.props.setCellValue(this.getCellKey(cell), value)
  }

  getCellValue(cell: CellAddress):string {
    return this.props.data[this.getCellKey(cell)] || ""
  }

  renderCols(row:number) {
    const cols:JSX.Element[] = [<td key="header" className="row-header">{row + 1}</td>]
    for (let col=0; col < this.props.cols; col++) {
      let cell = {row, col}
      cols.push(<SpreadsheetCell
                  key={col}
                  value={this.getCellValue(cell)}
                  cell={cell}
                  currentCell={this.state.currentCell}
                  setCurrentCell={this.setCurrentCell}
                  editingCell={this.state.editingCell}
                  editSelectAll={this.state.editSelectAll}
                  setEditingCell={this.setEditingCell}
                  setCellValue={this.setCellValue}
                  move={this.move}
                />)
    }
    return cols
  }

  renderColHeader() {
    const header:JSX.Element[] = [<td key="spacer" className="row-header"></td>]
    for (let col=0; col < this.props.cols; col++) {
      header.push(<td key={col} className="col-header">{String.fromCharCode(65 + col)}</td>)
    }
    return <tr key="header">{header}</tr>
  }

  renderRows() {
    const rows:JSX.Element[] = [this.renderColHeader()]
    for (let row = 0; row < this.props.rows; row++) {
      rows.push(<tr key={row}>{this.renderCols(row)}</tr>)
    }
    return rows
  }

  render() {
    return (
      <div className="spreadsheet">
        <table>
          <tbody>
            {this.renderRows()}
          </tbody>
        </table>
      </div>
    )
  }
}
