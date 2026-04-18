const path = require('path');

/** @type {import('webpack').Configuration} */
module.exports = {
  mode: 'development',
  target: 'electron-main',
  entry: {
    main: path.resolve(__dirname, 'src/main/main.ts'),
    preload: path.resolve(__dirname, 'src/main/preload.ts')
  },
  devtool: 'source-map',
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  output: {
    filename: '[name].js',
    path: path.resolve(__dirname, 'dist')
  },
  node: {
    __dirname: false,
    __filename: false
  }
};
