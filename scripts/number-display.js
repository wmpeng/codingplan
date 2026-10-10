(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NumberDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const significant = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 3, useGrouping: true });
  const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: true });
  const fixedPrice = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  const general = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, useGrouping: true });
  function finite(value) {
    if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const number = Number(value);
    return Number.isFinite(number) ? (number === 0 ? 0 : number) : null;
  }
  function format(value, formatter, unknown = '—') {
    const number = finite(value);
    return number === null ? unknown : formatter.format(number);
  }
  const tokens = (value, unknown) => value === 'unlimited' ? '不限量' : format(value, significant, unknown);
  const count = (value, unknown) => format(value, integer, unknown);
  const amount = (value, unknown) => format(value, general, unknown);
  function money(value, currency, formatter, floor, unknown) {
    const number = finite(value);
    if (number === null || number < 0) return unknown;
    const prefix = number > 0 && number < floor / 2 ? '<' : '';
    return `${prefix}${currency}${formatter.format(prefix ? floor : number)}`;
  }
  const unitPrice = (value, currency = '¥', unknown = '—') => money(value, currency, fixedPrice, 0.01, unknown);
  const monthlyFee = (value, currency = '¥', unknown = '—') => money(value, currency, integer, 1, unknown);
  const tokenFactor = unit => unit === 'B' ? 1000 : unit === 'yi' ? 100 : 1;
  const tokenUnit = unit => unit === 'B' ? 'B' : unit === 'yi' ? '亿' : 'M';
  function tokenAmount(value, unit, unknown) {
    if (value === 'unlimited') return tokens(value);
    const number = finite(value);
    return tokens(number === null ? null : number / tokenFactor(unit), unknown);
  }
  function tokenPrice(value, unit, unknown) {
    const number = finite(value);
    return unitPrice(number === null ? null : number * tokenFactor(unit), '¥', unknown);
  }
  function range(values, formatter) {
    const known = values.map(finite).filter(value => value !== null && value >= 0);
    if (!known.length) return null;
    const min = formatter(Math.min(...known)), max = formatter(Math.max(...known));
    return min === max ? min : `${min}～${max}`;
  }
  return { finite, tokens, count, amount, unitPrice, monthlyFee, tokenFactor, tokenUnit, tokenAmount, tokenPrice, range };
});
