module.exports = {
  /**
   * The default mod to be used in a jiff instance if a custom mod was not provided.
   */
  gZp: 16777729,

  /**
   * Socket connection timeouts
   */
  reconnectionDelay: 25000,
  reconnectionDelayMax: 27500,
  randomizationFactor: 0.1,

  /**
   * Maximum numbers of retries on failed initialization.
   */
  maxInitializationRetries: 2
};