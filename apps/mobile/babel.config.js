module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    // react-native-reanimated/plugin 은 worklets 사용 시에만 필요. 우리는 미사용.
    plugins: [],
  };
};
