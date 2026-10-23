/* 先在本地开发库验证；后端正式部署完成后再开启 enabled。 */
globalThis.CodingPlanEventCollectConfig = {
  enabled: false,
  endpoint: 'https://api.dreamfree.space/c/events/collect',
  localEndpoint: 'http://127.0.0.1:5051/events/collect'
};
