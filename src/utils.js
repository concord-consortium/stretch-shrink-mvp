
// Given a character an an amount to advance, gives the character that many forward in the alphabet
export function nextChar(c, incAmount = 1) {
  return String.fromCharCode(c.charCodeAt(0) + incAmount);
}

// Given a hex color, returns an RGB color object of the form {r: #, g: #, b: #}
export function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
}

// Given a grid shape name, returns the corresponding sheet column
// For example, passing Poly' would return "C"
export function shapeNameToCol(shapeName) {
  let suffixSize = (shapeName.match(/'/g) || []).length;

  return nextChar("B", suffixSize);
}

// Extracts the row number from a sheet object
// For example, "A6" would return the number 6
export function getRowFromSheetObject(sheetObject) {
  return parseInt(sheetObject.slice(1));
}

// Converts a grid point to the corresponding row in the sheet
// For example, passing B'' would return 4
export function gridObjToSpreadSheetRow(gridObj) {
  let objNum = gridObj.charCodeAt(0),
      objNumDelta = objNum - 65;

  return objNumDelta + 3;
}

// Converts a sheet row to the corresponding grid point
// For example, passing 4 would return B
export function spreadSheetRowToGridObj(spreadsheetRow) {
  return String.fromCharCode(65 + (spreadsheetRow - 3));
}

// Rounds a given number to 2 decimal places
export function roundToDecimal(num) {
  return Math.round(num * 100) / 100;
}

export function log(msg) {
  if(console && console.log) {
    console.log(msg);
  }
}