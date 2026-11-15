(function (root) {
  'use strict';
  const STATES = Object.freeze(['UNKNOWN', 'FREE', 'OCCUPIED']);
  function createState() { return { blockStates: Object.create(null), routes: [], reservations: Object.create(null) }; }
  function ensureBlocks(state, blockIds) {
    const valid = new Set(blockIds);
    for (const id of valid) if (!state.blockStates[id]) state.blockStates[id] = 'UNKNOWN';
    const removed = Object.keys(state.blockStates).filter(id => !valid.has(id));
    const affectedRoutes = new Set(removed.map(id => state.reservations[id]).filter(Boolean));
    for (const id of removed) { delete state.blockStates[id]; delete state.reservations[id]; }
    // If a route loses any of its blocks, release every remaining reservation it owns.
    for (const [blockId, owner] of Object.entries(state.reservations)) {
      if (affectedRoutes.has(owner)) delete state.reservations[blockId];
    }
    return state;
  }
  function setRoutes(state, routes) {
    state.routes = (routes || []).map(route => ({ id:String(route.id), name:String(route.name), blockIds:[...new Set(route.blockIds || [])] }));
    const routeIds = new Set(state.routes.map(route => route.id));
    for (const blockId of Object.keys(state.reservations)) if (!routeIds.has(state.reservations[blockId])) delete state.reservations[blockId];
    return state;
  }
  function addRoute(state, route, knownBlockIds) {
    const name = String(route.name || '').trim(), blockIds = [...new Set((route.blockIds || []).map(String))];
    if (!name) return {ok:false,error:'Escriu un nom per a l’itinerari.'};
    if (!blockIds.length) return {ok:false,error:'Selecciona almenys un bloc.'};
    if (blockIds.some(id => !knownBlockIds.includes(id))) return {ok:false,error:'L’itinerari conté un bloc que no existeix.'};
    if (state.routes.some(item => item.name.toLowerCase() === name.toLowerCase())) return {ok:false,error:'Ja existeix un itinerari amb aquest nom.'};
    const id = String(route.id || 'R-' + Date.now());
    if (state.routes.some(item => item.id === id)) return {ok:false,error:'L’identificador d’itinerari ja existeix.'};
    state.routes.push({id,name,blockIds});
    return {ok:true,route:state.routes[state.routes.length-1]};
  }
  function reserveRoute(state, routeId) {
    const route = state.routes.find(item => item.id === routeId);
    if (!route) return {ok:false,error:'Itinerari inexistent.'};
    for (const blockId of route.blockIds) {
      const status = state.blockStates[blockId] || 'UNKNOWN';
      if (status !== 'FREE') return {ok:false,error:'No es pot reservar: el bloc ' + blockId + ' no està lliure (' + status + ').'};
      const owner = state.reservations[blockId];
      if (owner && owner !== route.id) return {ok:false,error:'Conflicte: el bloc ' + blockId + ' ja està reservat.'};
    }
    for (const blockId of route.blockIds) state.reservations[blockId] = route.id;
    return {ok:true};
  }
  function releaseRoute(state, routeId) {
    const route = state.routes.find(item => item.id === routeId);
    if (!route) return {ok:false,error:'Itinerari inexistent.'};
    for (const blockId of route.blockIds) if (state.reservations[blockId] === route.id) delete state.reservations[blockId];
    return {ok:true};
  }
  function setBlockState(state, blockId, status) {
    if (!STATES.includes(status)) return {ok:false,error:'Estat de bloc no vàlid.'};
    if (!(blockId in state.blockStates)) return {ok:false,error:'Bloc inexistent.'};
    state.blockStates[blockId] = status;
    const owner = state.reservations[blockId];
    if (status !== 'FREE' && owner) {
      releaseRoute(state, owner);
      return {ok:true,releasedRoutes:[owner]};
    }
    return {ok:true,releasedRoutes:[]};
  }
  const api = {STATES,createState,ensureBlocks,setRoutes,addRoute,reserveRoute,releaseRoute,setBlockState};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.JMRI_TC_DispatcherCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
