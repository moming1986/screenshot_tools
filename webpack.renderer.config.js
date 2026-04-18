const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: 'development',
  target: 'electron-renderer',
  entry: {
    renderer: path.resolve(__dirname, 'src/renderer/index.tsx'),
    console: path.resolve(__dirname, 'src/renderer/console.tsx')
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.tsx', '.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/index.html'),
      filename: 'index.html',
      chunks: ['renderer']
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'src/renderer/console.html'),
      filename: 'console.html',
      chunks: ['console']
    }),
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'src/renderer/locale'),
          to: path.resolve(__dirname, 'dist/locale')
        }
      ]
    })
  ]
};
