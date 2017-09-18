/* global module:true, require:true __dirname */

const path = require("path");
const webpack = require("webpack");
const CopyWebpackPlugin = require("copy-webpack-plugin");


module.exports = {
  entry: {
    'index': ["./src/main.js"],
  },

  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].js",
    libraryTarget: "var",
    library: "MugWump"
  },
  resolve: {
    extensions: [".webpack.js", ".web.js", ".ts", ".tsx", ".js"]
  },
  devtool: "source-map",
  module: {
    loaders: [
      // All files with a '.ts' or '.tsx' extension will be handled by 'awesome-typescript-loader'.
      {
        test: /\.tsx?$/,
        loader: "awesome-typescript-loader",
        options: {
          configFileName: "./tsconfig.json"}
        },
    ]
  },
  stats: {
    colors: true
  },
  plugins: [
    new CopyWebpackPlugin([
      { from: "src/*.html",  flatten: "true"},
      { from: "src/*.css",  flatten: "true"}
    ])
  ]
};
