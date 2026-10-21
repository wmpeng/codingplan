(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.NumberDisplay = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const significant = new Intl.NumberFormat('en-US', { minimumSignificantDigits: 4, maximumSignificantDigits: 4, useGrouping: true });
  const integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0, useGrouping: true });
  const decimal = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
  function finite(value) {
    if (value == null || typeof value === 'boolean' || (typeof value === 'string' && !value.trim())) return null;
    if (typeof value !== 'number' && typeof value !== 'string') return null;
    const number = Number(value);
    return Number.isFinite(number) ? (number === 0 ? 0 : number) : null;
  }
  function format(value, unknown = '—') {
    const number = finite(value);
    if (number === null) return unknown;
    const magnitude = Math.abs(number);
    if (number === 0) return '0';
    if (magnitude < 0.0001) return number > 0 ? '<0.0001' : '>-0.0001';
    if (magnitude < 0.01) return significant.format(number);
    return (magnitude >= 100 || Number.isInteger(number) ? integer : decimal).format(number);
  }
  const tokens = (value, unknown) => value === 'unlimited' ? '不限量' : format(value, unknown);
  const count = format;
  const amount = format;
  function money(value, currency, unknown) {
    if (value === '不适用') return value;
    const number = finite(value);
    if (number === null || number < 0) return unknown;
    const text = format(number);
    return text.startsWith('<') ? `<${currency}${text.slice(1)}` : `${currency}${text}`;
  }
  const unitPrice = (value, currency = '¥', unknown = '—') => money(value, currency, unknown);
  const monthlyFee = (value, currency = '¥', unknown = '—') => money(value, currency, unknown);
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
  function range(values, formatter, endFormatter = formatter) {
    const known = values.map(finite).filter(value => value !== null && value >= 0);
    if (!known.length) return null;
    const min = formatter(Math.min(...known)), max = formatter(Math.max(...known));
    return min === max ? min : `${min}～${endFormatter(Math.max(...known))}`;
  }
  return { finite, tokens, count, amount, unitPrice, monthlyFee, tokenFactor, tokenUnit, tokenAmount, tokenPrice, range };
});
