const utils = require("./utils");

// import { Sharing } from "./sharing";
// const Sharing = require("./sharing");
import Sharing from "./sharing";
import { getParam, addParamChangeListener, setParam }  from "./params";
import { SharingParamDefault, escapeFirebaseKey } from "cc-sharing";

let objectsToListeners = {},
    app1Loaded = false,
    app2Loaded = false,
    firstLoad = true,
    pointNames = [];

let sheetFirebaseRef = null;
let gridFirebaseRef  = null;
let addedSharing     = false;
const cloneId        = getParam("sharing_clone");
const publicationId  = getParam("sharing_publication");
const isClone        = cloneId ? cloneId !== SharingParamDefault : false;
const isPublication  = publicationId ? publicationId !== SharingParamDefault : false;

const logId = Math.round(Math.random() * 100000000);

function checkForCloneOnLoad(callback) {
  if (isClone) {
    console.log("MW Clone Ref", getCloneUrl());
    const cloneRef = firebase.database().ref(getCloneUrl());
    cloneRef.once("value", function (cloneSnapshot) {
      if (!cloneSnapshot.val()) {
        // clone has no value so copy the base data into it
        cloneData(cloneRef, callback);
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

function cloneData(cloneRef, callback) {
  const baseRef = firebase.database().ref(getBaseUrl(true));
  baseRef.once("value", function (baseSnapshot) {
    const data = baseSnapshot.val();
    cloneRef.set(data);
    if (callback) {
      callback();
    }
  });
}

window.ggbOnInit = function(appName) {
  if (appName == "gridApp") {
    loadGridXML("ggbOnInit");
  }
  if (appName == "sheetApp") {
    loadSheetXML("ggbOnInit");
  }
};

function checkAppsLoaded() {
  if (app1Loaded && app2Loaded && firstLoad) {
    const share = new Sharing( () => [
      { app: gridApp, name: "gridApp"   },
      { app: sheetApp, name: "sheetApp" }
    ], isClone, cloneData);
    addParamChangeListener(resetFirebase);

    pauseListeners();

    makePolygonsFromSpreadsheet();
    makeMidpoints();
    firstLoad = false;

    restartListeners();
  }
}

// TODO: Combine the logic of these functions
function loadGridXML(via) {
  let db = firebase.database();
  if(gridFirebaseRef) {
    gridFirebaseRef.off();
    gridFirebaseRef = null;
    //utils.log(" ✔ removed grid listener");
  }

  const postGridXMLLoad = () => {
    app1Loaded = true;
    checkAppsLoaded();
  };

  // don't load default data
  if (isDefaultBaseUrl()) {
    postGridXMLLoad();
    return;
  }

  gridFirebaseRef = db.ref(getBaseUrl() + "/gridApp");
  console.log("MW gridFirebaseRef via", via, gridFirebaseRef.toString());

  gridFirebaseRef.on("value", function(snapshot) {
    if (snapshot.val() && snapshot.val() !== gridApp.getXML()) {
      gridApp.setXML(snapshot.val());
      if (!firstLoad) {
        // Setting the XML removes listeners, so they must be re-added
        restartListeners();
      }
    }
    postGridXMLLoad();
    //utils.log(" ✔ new firebase grid data");
  });
}

function loadSheetXML(via) {
  let db = firebase.database();
  if(sheetFirebaseRef) {
    sheetFirebaseRef.off();
    sheetFirebaseRef = null;
    //utils.log(" ✔ removed sheet listener");
  }

  const postSheetXMLLoad = () => {
    app2Loaded = true;
    checkAppsLoaded();
  };

  // don't load default data
  if (isDefaultBaseUrl()) {
    postSheetXMLLoad();
    return;
  }

  sheetFirebaseRef = db.ref(getBaseUrl() + "/sheetApp");
  console.log("MW sheetFirebaseRef via", via, sheetFirebaseRef.toString());
  sheetFirebaseRef.on("value", function(snapshot) {
    if (snapshot.val() && snapshot.val() !== sheetApp.getXML()) {
      sheetApp.setXML(snapshot.val());
      pauseListeners();
      makePolygonsFromSpreadsheet();
      if (!firstLoad) {
        restartListeners();
      }
    }
    postSheetXMLLoad();
    //utils.log(" ✔ new firebase sheet data");
  });
}

function resetFirebase(via) {
  //utils.log(" ✔ reseting Firebase");
  loadGridXML(via);
  loadSheetXML(via);
}


function addListener(objName, func) {
  objectsToListeners[objName] = func;
}

function removeListener(objName) {
  objectsToListeners[objName] = null;
}

function pauseListeners() {
  gridApp.unregisterUpdateListener(gridListener);
  sheetApp.unregisterUpdateListener(sheetListener);
  sheetApp.unregisterAddListener(sheetListener);

  let undoButtons = document.querySelectorAll(".undoButton"),
      redoButtons = document.querySelectorAll(".redoButton");

  undoButtons[0].onclick = null;
  redoButtons[0].onclick = null;
  undoButtons[1].onclick = null;
  redoButtons[1].onclick = null;
}

function restartListeners() {
  pauseListeners();
  gridApp.registerUpdateListener(gridListener);
  sheetApp.registerUpdateListener(sheetListener);
  sheetApp.registerAddListener(sheetListener);

  let undoButtons = document.querySelectorAll(".undoButton"),
      redoButtons = document.querySelectorAll(".redoButton");

  undoButtons[0].onclick = sheetUndoRedoListener;
  redoButtons[0].onclick = sheetUndoRedoListener;
  undoButtons[1].onclick = gridUndoRedoListener;
  redoButtons[1].onclick = gridUndoRedoListener;
}

function sheetUndoRedoListener() {
  pauseListeners();

  //utils.log("Undo/redo grid event");
  // Assume every row changed
  pointNames.forEach(pointName => {
    let row = utils.gridObjToSpreadSheetRow(pointName);
    rowListener("B" + row);
  });

  restartListeners();
}

function gridUndoRedoListener() {
  pauseListeners();

  //utils.log("Undo/redo sheet event");
  // Assume every point moved
  pointNames.forEach(pointName => {
    pointListener(pointName);
  });

  restartListeners();
}

function rulesOff() {
  const _rulesOff = getParam("rulesOff");
  return _rulesOff && _rulesOff !== "false";
}

function sheetListener(objName) {
  if (rulesOff()) {
    if (!objName.startsWith("B")) {
      plotListener(objName);
    }
  } else {
    let rowNum = utils.getRowFromSheetObject(objName);
    if (rowNum == 1) {
      makeButtons();
    } else if (rowNum === 2) {
      ruleListener(objName);
    } else if (rowNum >= 3) {
      rowListener(objName);
    }
  }
}

function gridListener(objName) {
  if (objectsToListeners[objName]) {
    objectsToListeners[objName](objName);
  }
}

// Checks if a shape exists by checking if it has a rule
function doesShapeExist(col) {
  return sheetApp.getValueString(col + 2) !== "";
}

function resetSave() {
  if (isDefaultBaseUrl()) {
    return;
  }

  let database = firebase.database(),
      ref = database.ref(getBaseUrl()),
      update = {
        gridApp: null,
        sheetApp: null
      };
  ref.update(update);
  location.reload();
}

function toggleBaseComparison() {
  pauseListeners();

  if (!gridApp.getVisible("PolyCopy")) {
    let copyPolyCommand = "PolyCopy = Polygon(";
    for (let i = 0; i < pointNames.length - 1; i++) {
      let coords = getPointCoords(pointNames[i]);
      copyPolyCommand += "(" + coords[0] + ", " + coords[1] + "), ";
    }

    let lastCoords = getPointCoords(pointNames[pointNames.length - 1]);
    copyPolyCommand += "(" + lastCoords[0] + ", " + lastCoords[1] + "))";

    gridApp.evalCommand(copyPolyCommand);
    let color = utils.hexToRgb(gridApp.getColor("Poly"));
    gridApp.setColor("PolyCopy", color.r, color.g, color.b);
    gridApp.setVisible("PolyCopy", true);
  } else {
    gridApp.setVisible("PolyCopy", false);
  }

  restartListeners();
}

// debounce saving so that polygon drags are performant
let saveStateTimeout = null;
function saveState() {
  clearTimeout(saveStateTimeout);
  saveStateTimeout = setTimeout(() => {
    saveGridXML();
    saveSheetXML();
  }, 100);
}

function saveGridXML() {
  if (isDefaultBaseUrl()) {
    return;
  }

  let database = firebase.database(),
      ref = database.ref(getBaseUrl()),
      update = {
        gridApp: gridApp.getXML()
      };

  ref.update(update);
}

function saveSheetXML() {
  if (isDefaultBaseUrl()) {
    return;
  }

  let baseXML = sheetApp.getXML(),
      parser = new DOMParser(),
      xmlDoc = parser.parseFromString(baseXML,"text/xml"),
      elems = Array.prototype.slice.call(xmlDoc.getElementsByTagName("element"), 0);

  // Remove empty cells or they load with question marks
  elems.forEach(elem => {
    let value = elem.getElementsByTagName("value")[0];
    if (value) {
      if (isNaN(parseInt(value.getAttribute("val")))) {
        elem.parentElement.removeChild(elem);
      }
    }
  });

  let database = firebase.database(),
      ref = database.ref(getBaseUrl()),
      update = {
        sheetApp: new XMLSerializer().serializeToString(xmlDoc)
      };

  ref.update(update);
}

function getCloneUrl() {
  const cloneUrl = `clones/${cloneId}`;
  return cloneUrl;
}

function isDefaultBaseUrl() {
  const publicationId = escapeFirebaseKey(getParam("sharing_publication", SharingParamDefault)),
        offeringId = escapeFirebaseKey(getParam("sharing_offering", SharingParamDefault)),
        groupId = escapeFirebaseKey(getParam("sharing_group", SharingParamDefault)),
        classId = escapeFirebaseKey(getParam("sharing_class", SharingParamDefault));
  return (publicationId === SharingParamDefault) && (offeringId === SharingParamDefault) && (groupId === SharingParamDefault) && (classId === SharingParamDefault);
}

function getBaseUrl(forceNonCloneUrl) {
  const offeringId = escapeFirebaseKey(getParam("sharing_offering", SharingParamDefault)),
        groupId = escapeFirebaseKey(getParam("sharing_group", SharingParamDefault)),
        classId = escapeFirebaseKey(getParam("sharing_class", SharingParamDefault));

  if (!isClone || forceNonCloneUrl) {
    if (isPublication) {
      return `publications/${publicationId}`;
    }
    const baseUrl = `classes/${classId}/groups/${groupId}/offerings/${offeringId}`;
    //console.log("Mugwumps BaseUrl:", baseUrl);
    return baseUrl;
  }
  return getCloneUrl();
}

// Retrieves max coords from the graph
function getMaxCoords(pointSuffix="") {
  let maxX = 0,
      maxY = 0;
  pointNames.forEach(basePointName => {
    let pointName = basePointName + pointSuffix,
        x = gridApp.getXcoord(pointName),
        y = gridApp.getYcoord(pointName);

    if (x > maxX) {
      maxX = x;
    }
    if (y > maxY) {
      maxY = y;
    }
  });

  return [maxX, maxY];
}

function getPointCoords(pointName, pointSuffix="") {
  let fullPointName = pointName + pointSuffix;
  return [gridApp.getXcoord(fullPointName), gridApp.getYcoord(fullPointName)];
}

function getRowCoords(rowNum, col="B") {
  let coordRegex = /(\-?\d*\.?\d+),\s*(\-?\d*\.?\d+)/g,
      point = sheetApp.getValueString(col + rowNum),
      matches = coordRegex.exec(point) || [null, null],
      xCoord = matches[1],
      yCoord = matches[2];

  return [xCoord, yCoord];
}

function makeButtonHandler(suffix) {
  return function() {
    pauseListeners();
    let gridShapeName = "Poly" + suffix,
        visibility = gridApp.getVisible(gridShapeName);

    gridApp.setVisible(gridShapeName, !visibility);
    pointNames.forEach(name => {
      gridApp.setVisible(name + suffix, !visibility);
    });
    restartListeners();
  };
}

function makeButtons() {
  let col = "C",
      suffix = "'",
      buttonsDiv = document.getElementById("visiblity-buttons");

  document.getElementById("reset").addEventListener("click", resetSave);
  document.getElementById("toggle-compare").addEventListener("click", toggleBaseComparison);

  buttonsDiv.innerHTML = "";
  while (true) {
    if (doesShapeExist(col)) {
      let shapeName = sheetApp.getValueString(col + 1),
          shapeColor = sheetApp.getColor(col + 1),
          button = document.createElement("button");

      button.onclick = makeButtonHandler(suffix);

      button.innerText = "Toggle " + shapeName + " visibility";
      button.style.color = shapeColor;
      let buttonsDiv = document.getElementById("visiblity-buttons");
      buttonsDiv.appendChild(button);
      col = utils.nextChar(col);
      suffix += "'";
    } else {
      break;
    }
  }
}

function makePolygonsFromSpreadsheet() {
  let col = "B",
      suffix = "";

  while (true) {
    if (doesShapeExist(col)) {
      makePolygonFromSpreadsheet(col, suffix);
      col = utils.nextChar(col);
      suffix += "'";
    } else {
      break;
    }
  }
  makeButtons();
}

function makePolygonFromSpreadsheet(col, pointSuffix = "") {
  let coords = [],
      xCoord = null,
      yCoord = null,
      row = 3,
      pointName = "A",
      polyName = "Poly" + pointSuffix,
      polyString = polyName + " = Polygon(",
      addPointListener = pointName => addListener(pointName, pointListener);
  while (true) {
    coords = getRowCoords(row, col);
    xCoord = coords[0];
    yCoord = coords[1];

    if (!isNaN(xCoord) && !isNaN(yCoord)) {
      gridApp.evalCommand(pointName + pointSuffix + " = (" + xCoord + ", " + yCoord + ")");
      polyString += pointName + pointSuffix + ", ";
      if (pointNames.indexOf(pointName) === -1) {
        pointNames.push(pointName);
      }
      addListener(pointName + pointSuffix, pointListener);
      gridApp.setLabelVisible(pointName + pointSuffix, true);
    } else {
      polyString = polyString.slice(0, polyString.length - 2) + ")";
      gridApp.evalCommand(polyString);

      pointNames.forEach(addPointListener);

      let hexColor = sheetApp.getColor(col + 1),
          rgbColor = utils.hexToRgb(hexColor);
      gridApp.setColor(polyName, rgbColor.r, rgbColor.g, rgbColor.b);

      if (!rulesOff() && pointSuffix.length > 0) {
        addListener(polyName, translateListener);
      }

      break;
    }

    row++;
    pointName = utils.nextChar(pointName);
  }
}

// Assuming that the graph points are correct, draws in new midpoints
function makeMidpoints() {
  let maxCoords = getMaxCoords("'"),
      maxX = maxCoords[0],
      maxY = maxCoords[1];

  if (rulesOff()) {
    return;
  }

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

  addListener("Y_MID", dilateXListener);
  addListener("X_MID", dilateYListener);
  addListener("XY_MAX", dilateXYListener);
}

function getDilationRules(col) {
  let rulePair = sheetApp.getValueString(col + 2),
      xRegex = /(\-?\d*\.?\d+)x/g,
      yRegex = /(\-?\d*\.?\d+)y/g,
      xMatch = xRegex.exec(rulePair),
      yMatch = yRegex.exec(rulePair),
      xDilation = xMatch ? parseFloat(xMatch[1]) : 1,
      yDilation = yMatch ? parseFloat(yMatch[1]) : 1;

  return [xDilation, yDilation];
}

function getTranslationRules(col) {
  let rulePair = sheetApp.getValueString(col + 2),
      xRegex = /x\s*(\-|\+)\s*(\d*\.?\d+)/g,
      yRegex = /y\s*(\-|\+)\s*(\d*\.?\d+)/g,
      xMatch = xRegex.exec(rulePair),
      yMatch = yRegex.exec(rulePair),
      // Grab the parsed sign and number for translation rule
      xTranslation = xMatch ? parseFloat(xMatch[1] + xMatch[2]) : 0,
      yTranslation = yMatch ? parseFloat(yMatch[1] + yMatch[2]) : 0;

  return [xTranslation, yTranslation];
}

function setCellCoordinateValue(objName, xCoord, yCoord) {
  sheetApp.evalCommand(objName + " = (" + xCoord + ", " + yCoord + ")");
  sheetApp.setColor(objName, 0, 0, 0);
}

// Transforms a point in the graph and corresponding row in spreadsheet. Bases transformation
// off of base position and rules from the spreadsheet.
function transformPoint(pointName) {
  let col = "C",
      suffix = "'";

  if (rulesOff()) {
    return;
  }

  while (true) {
    if (doesShapeExist(col)) {
      transformPointForShape(pointName, col, suffix);
      col = utils.nextChar(col);
      suffix += "'";
    } else {
      break;
    }
  }
}

function transformPointForShape(pointName, col, suffix) {
  // Update transformed point coords in spreadsheet
  let dilationRules = getDilationRules(col),
      translationRules = getTranslationRules(col),
      spreadsheetRow = utils.gridObjToSpreadSheetRow(pointName),
      baseCoords = getRowCoords(spreadsheetRow),
      dilatedCoords = [baseCoords[0] * dilationRules[0], baseCoords[1] * dilationRules[1]],
      transformedCoords = [dilatedCoords[0] + translationRules[0], dilatedCoords[1] + translationRules[1]];

  setCellCoordinateValue(col + spreadsheetRow, transformedCoords[0], transformedCoords[1]);

  // Update transformed points on graph
  gridApp.setCoords(pointName + suffix, transformedCoords[0], transformedCoords[1]);
}

function pointListener(objName) {
  pauseListeners();

  //utils.log("Point listener: " + objName);
  let newCoords = getPointCoords(objName),
      spreadsheetCol = utils.shapeNameToCol(objName),
      spreadsheetRow = utils.gridObjToSpreadSheetRow(objName),
      oldCoords = getRowCoords(spreadsheetRow);

  // Update point coords in spreadsheet
  setCellCoordinateValue(spreadsheetCol + spreadsheetRow, newCoords[0], newCoords[1]);

  // Update transformed point coords in spreadsheet
  transformPoint(objName);

  makeMidpoints();
  saveState();

  restartListeners();
}

// TODO: merge these into a single dilate listener
function dilateXListener(objName) {
  pauseListeners();

  //utils.log("Dilate X listener: " + objName);
  let newX = gridApp.getXcoord(objName),
      baseX = getMaxCoords()[0],
      newXDilation = Math.round(newX / baseX * 100) / 100,
      yDilation = getDilationRules("C")[1];

  sheetApp.setTextValue("C2", "(" + newXDilation + "x, " + yDilation + "y)");

  pointNames.forEach(pointName => {
    transformPoint(pointName);
  });

  makeMidpoints();
  saveState();

  restartListeners();
}

function dilateYListener(objName) {
  pauseListeners();

  //utils.log("Dilate Y listener: " + objName);
  let newY = gridApp.getYcoord(objName),
      baseY = getMaxCoords()[1],
      newYDilation = Math.round(newY / baseY * 100) / 100,
      xDilation = getDilationRules("C")[0];

  sheetApp.setTextValue("C2", "(" + xDilation + "x, " + newYDilation + "y)");

  pointNames.forEach(pointName => {
    transformPoint(pointName);
  });

  makeMidpoints();
  saveState();

  restartListeners();
}

function dilateXYListener(objName) {
  pauseListeners();

  //utils.log("Dilate XY listener: " + objName);
  let oldDilations = getDilationRules("C"),
      newCoords = getPointCoords(objName),
      baseCoords = getMaxCoords(),
      // We need to scale both dilations by the same amount to maintain aspect ratio
      // Base the scaling amount on the change in the x direction for simplicity
      newXDilation = newCoords[0] / baseCoords[0],
      scaleFactor = newXDilation / oldDilations[0],
      newDilations = [oldDilations[0] * scaleFactor, oldDilations[1] * scaleFactor];

  sheetApp.setTextValue("C2", "(" + utils.roundToDecimal(newDilations[0]) + "x, " + utils.roundToDecimal(newDilations[1]) + "y)");

  pointNames.forEach(pointName => {
    transformPoint(pointName);
  });

  makeMidpoints();
  saveState();

  restartListeners();
}

function ruleListener(objName) {
  pauseListeners();

  //utils.log("Rule listener: " + objName);
  pointNames.forEach(pointName => {
    transformPoint(pointName);
  });

  makeMidpoints();
  saveState();

  restartListeners();
}

function rowListener(objName) {
  pauseListeners();

  //utils.log("Row listener: " + objName);
  let row = utils.getRowFromSheetObject(objName),
      rowCoords = getRowCoords(row, "B");

  if (!isNaN(rowCoords[0]) && !isNaN(rowCoords[1])) {
    let pointName = utils.spreadSheetRowToGridObj(row);

    // Transform and draw the new shape
    transformPoint(pointName);
    sheetApp.setTextValue("A" + row, pointName);
    makePolygonsFromSpreadsheet();
    makeMidpoints();

    saveState();
  }

  restartListeners();
}

function translateListener(objName) {
  pauseListeners();

  //utils.log("Translate listener: " + objName);
  // Pick a representative point from the transformed shape to find translation rules
  let sampleRow = 3,
      baseObj = utils.spreadSheetRowToGridObj(sampleRow),
      baseCoords = getPointCoords(baseObj),
      col = utils.shapeNameToCol(objName),
      dilationRules = getDilationRules(col),
      dilatedCoords = [baseCoords[0] * dilationRules[0], baseCoords[1] * dilationRules[1]],

      transformedObj = baseObj + objName.slice(objName.indexOf("'")),
      transformedCoords = getPointCoords(transformedObj),
      newTranslationRules = [Math.round((transformedCoords[0] - dilatedCoords[0]) * 100) / 100,
                             Math.round((transformedCoords[1] - dilatedCoords[1]) * 100) / 100],

      xTransform = newTranslationRules[0] >= 0 ? dilationRules[0] + "x + " + newTranslationRules[0] : dilationRules[0] + "x - " + Math.abs(newTranslationRules[0]),
      yTransform = newTranslationRules[1] >= 0 ? dilationRules[1] + "y + " + newTranslationRules[1] : dilationRules[1] + "y - " + Math.abs(newTranslationRules[1]);

  sheetApp.setTextValue(col + 2, "(" + xTransform + ", " + yTransform + ")");

  pointNames.forEach(pointName => {
    transformPoint(pointName);
  });

  makeMidpoints();
  saveState();

  restartListeners();
}

function plotListener(objName) {
  pauseListeners();
  makePolygonsFromSpreadsheet();
  makeMidpoints();
  saveState();
  restartListeners();
}

function getGridId() {
  return getParam("gridId");
}

function getSheetId() {
  return getParam("sheetId");
}

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
  "material_id": getGridId()
};


const parameters2 = {
  "id": "sheetApp",
  "width":700,
  "height":550,
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
  "material_id": getSheetId()
};

// is3D=is 3D applet using 3D view, AV=Algebra View, SV=Spreadsheet View, CV=CAS View, EV2=Graphics View 2, CP=Construction Protocol, PC=Probability Calculator, DA=Data Analysis, FI=Function Inspector, PV=Python, macro=Macro View
const views = {'is3D': 0,'AV': 1,'SV': 1,'CV': 0,'EV2': 0,'CP': 0,'PC': 0,'DA': 0,'FI': 0,'PV': 0,'macro': 0};

export const applet = new GGBApplet(parameters, '5.0', views);
export const applet2 = new GGBApplet(parameters2, '5.0', views);
export const setGroup = (v) => setParam('sharing_group', v);
window.onload = function() {
  checkForCloneOnLoad(function () {
    applet.inject('gridApp');
    applet2.inject('sheetApp');
  });
};