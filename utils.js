// Contains all URL parameters
var urlParams;
(window.onpopstate = function () {
    var match,
        pl     = /\+/g,  // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function (s) { return decodeURIComponent(s.replace(pl, " ")); },
        query  = window.location.search.substring(1);

    urlParams = {};
    while ((match = search.exec(query)))
       urlParams[decode(match[1])] = decode(match[2]);
})();

// Given a character an an amount to advance, gives the character that many forward in the alphabet
function nextChar(c, incAmount = 1) {
  return String.fromCharCode(c.charCodeAt(0) + incAmount);
}

// Given a hex color, returns an RGB color object of the form {r: #, g: #, b: #}
function hexToRgb(hex) {
  var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
  } : null;
}

// Given a grid shape name, returns the corresponding sheet column
// For example, passing Poly' would return "C"
function shapeNameToCol(shapeName) {
  let suffixSize = (shapeName.match(/'/g) || []).length;

  return nextChar("B", suffixSize);
}

// Extracts the row number from a sheet object
// For example, "A6" would return the number 6
function getRowFromSheetObject(sheetObject) {
  return parseInt(sheetObject.slice(1));
}

// Converts a grid point to the corresponding row in the sheet
// For example, passing B'' would return 4
function gridObjToSpreadSheetRow(gridObj) {
  let objNum = gridObj.charCodeAt(0),
      objNumDelta = objNum - 65;

  return objNumDelta + 3;
}

// Converts a sheet row to the corresponding grid point
// For example, passing 4 would return B
function spreadSheetRowToGridObj(spreadsheetRow) {
  return String.fromCharCode(65 + (spreadsheetRow - 3));
}

// Rounds a given number to 2 decimal places
function roundToDecimal(num) {
  return Math.round(num * 100) / 100;
}
