/** @license

dhtmlxGantt for Node.js v.9.1.1 Professional Evaluation

This software is covered by DHTMLX Evaluation License. Contact sales@dhtmlx.com to get a proprietary license. Usage without proper license is prohibited.

(c) XB Software

*/
function Ne(e) {
  e._get_linked_task = function(l, r) {
    var d = null, c = r ? l.target : l.source;
    return e.isTaskExists(c) && (d = e.getTask(c)), d;
  }, e._get_link_target = function(l) {
    return e._get_linked_task(l, !0);
  }, e._get_link_source = function(l) {
    return e._get_linked_task(l, !1);
  };
  var n = !1, t = {}, a = {}, s = {}, i = {};
  function o(l) {
    return e.isSummaryTask(l) && l.auto_scheduling === !1;
  }
  e._isLinksCacheEnabled = function() {
    return n;
  }, e._startLinksCache = function() {
    t = {}, a = {}, s = {}, i = {}, n = !0;
  }, e._endLinksCache = function() {
    t = {}, a = {}, s = {}, i = {}, n = !1;
  }, e._formatLink = function(l, r, d) {
    if (n && t[l.id]) return t[l.id];
    var c = [], u = this._get_link_target(l), _ = this._get_link_source(l);
    if (!_ || !u || e.isSummaryTask(u) && e.isChildOf(_.id, u.id) || e.isSummaryTask(_) && e.isChildOf(u.id, _.id)) return c;
    const h = e._getAutoSchedulingConfig();
    var g = h.schedule_from_end && e.config.project_end, p = h.move_projects;
    h.apply_constraints && h.gap_behavior === "compress" && (p = !1), r = r || this.isSummaryTask(_) && !o(_) ? this.getSubtaskDates(_.id) : { start_date: _.start_date, end_date: _.end_date };
    var k = this._getImplicitLinks(l, _, function(w) {
      return p && g ? w.$source.length || e.getState("tasksDnd").drag_id == w.id ? 0 : e.calculateDuration({ start_date: w.end_date, end_date: r.end_date, task: _ }) : 0;
    }, !0);
    d || (d = { start_date: u.start_date, end_date: u.end_date }, this.isSummaryTask(u) && !o(u) && ((d = this.getSubtaskDates(u.id)).start_date = d.end_date, this.eachTask(function(w) {
      w.type !== this.config.types.project && !w.$target.length && w.start_date < d.start_date && (d.start_date = w.start_date);
    }, u.id)));
    for (var v = this._getImplicitLinks(l, u, function(w) {
      return !p || g || w.$target.length || e.getState("tasksDnd").drag_id == w.id ? 0 : e.calculateDuration({ start_date: d.start_date, end_date: w.start_date, task: u });
    }), f = 0, y = k.length; f < y; f++) for (var m = k[f], S = 0, C = v.length; S < C; S++) {
      var b = v[S], T = 1 * m.lag + 1 * b.lag, x = { id: l.id, type: l.type, source: m.task, target: b.task, subtaskLink: m.subtaskLink, lag: (1 * l.lag || 0) + T };
      e._linkedTasks[x.target] = e._linkedTasks[x.target] || {}, e._linkedTasks[x.target][x.source] = !0, c.push(e._convertToFinishToStartLink(b.task, x, _, u, m.taskParent, b.taskParent));
    }
    return n && (t[l.id] = c), c;
  }, e._isAutoSchedulable = function(l) {
    if (!(l.auto_scheduling !== !1 && l.unscheduled !== !0)) return !1;
    if (this.isSummaryTask(l)) {
      let r = !0;
      if (this.eachTask(function(d) {
        r && e._isAutoSchedulable(d) && (r = !1);
      }, l.id), r) return !1;
    }
    return !0;
  }, e._getImplicitLinks = function(l, r, d, c) {
    var u = [];
    if (this.isSummaryTask(r) && !o(r)) {
      var _, h = {};
      for (var g in this.eachTask(function(S) {
        this.isSummaryTask(S) && !o(S) || (h[S.id] = S);
      }, r.id), h) {
        var p = h[g];
        if (e._isAutoSchedulable(p)) {
          var k = c ? p.$source : p.$target;
          _ = !1;
          for (var v = 0; v < k.length && l.type != e.config.links.start_to_start && l.type != e.config.links.start_to_finish; v++) {
            var f = e.getLink(k[v]), y = c ? f.target : f.source, m = h[y];
            if (m && e._isAutoSchedulable(p) && e._isAutoSchedulable(m)) {
              let S = 0;
              if (f.lag && (S = Math.abs(f.lag)), f.type != e.config.links.finish_to_start) {
                S += e._convertToFinishToStartLink(null, {}, p, m).additionalLag;
                continue;
              }
              const C = f.target == m.id && S && S <= m.duration, b = f.target == p.id && S && S <= p.duration;
              if (C || b) {
                _ = !0;
                break;
              }
            }
          }
          if (!_) {
            let S = !0;
            for (const b in e._linkedTasks[p.id]) if (e.isChildOf(b, l.target)) {
              S = !1;
              break;
            }
            let C = 0;
            S && (C = d(p)), u.push({ task: p.id, taskParent: p.parent, lag: C, subtaskLink: !0 });
          }
        }
      }
    } else u.push({ task: r.id, taskParent: r.parent, lag: 0 });
    return u;
  }, e._getDirectDependencies = function(l, r) {
    e._linkedTasks = e._linkedTasks || {};
    for (var d = [], c = [], u = r ? l.$source : l.$target, _ = 0; _ < u.length; _++) {
      var h = this.getLink(u[_]);
      if (this.isTaskExists(h.source) && this.isTaskExists(h.target)) {
        var g = this.getTask(h.target);
        if (!this._isAutoSchedulable(g) || !this._isAutoSchedulable(l)) continue;
        if (e._getAutoSchedulingConfig().use_progress) {
          if (g.progress == 1) continue;
          d.push(h);
        } else d.push(h);
      }
    }
    for (_ = 0; _ < d.length; _++) c = c.concat(this._formatLink(d[_]));
    return c;
  }, e._getInheritedDependencies = function(l, r) {
    var d, c = !1, u = [];
    return this.isTaskExists(l.id) && this.eachParent(function(_) {
      var h;
      c || (n && (d = r ? a : s)[_.id] ? u = u.concat(d[_.id]) : this.isSummaryTask(_) && (this._isAutoSchedulable(_) ? (h = this._getDirectDependencies(_, r), n && (d[_.id] = h), u = u.concat(h)) : c = !0));
    }, l.id, this), u;
  }, e._getDirectSuccessors = function(l) {
    return this._getDirectDependencies(l, !0);
  }, e._getInheritedSuccessors = function(l) {
    return this._getInheritedDependencies(l, !0);
  }, e._getDirectPredecessors = function(l) {
    return this._getDirectDependencies(l, !1);
  }, e._getInheritedPredecessors = function(l) {
    return this._getInheritedDependencies(l, !1);
  }, e._getSuccessors = function(l, r) {
    var d = this._getDirectSuccessors(l);
    return r ? d : d.concat(this._getInheritedSuccessors(l));
  }, e._getPredecessors = function(l, r) {
    var d, c = String(l.id) + "-" + String(r);
    if (n && i[c]) return i[c];
    var u = this._getDirectPredecessors(l);
    return d = r ? u : u.concat(this._getInheritedPredecessors(l)), n && (i[c] = d), d;
  }, e._convertToFinishToStartLink = function(l, r, d, c, u, _) {
    var h = { target: l, link: e.config.links.finish_to_start, id: r.id, lag: r.lag || 0, sourceLag: 0, targetLag: 0, trueLag: r.lag || 0, source: r.source, preferredStart: null, sourceParent: u, targetParent: _, hashSum: null, subtaskLink: r.subtaskLink }, g = 0;
    switch (String(r.type)) {
      case String(e.config.links.start_to_start):
        g = -d.duration, h.sourceLag = g;
        break;
      case String(e.config.links.finish_to_finish):
        g = -c.duration, h.targetLag = g;
        break;
      case String(e.config.links.start_to_finish):
        g = -d.duration - c.duration, h.sourceLag = -d.duration, h.targetLag = -c.duration;
        break;
      default:
        g = 0;
    }
    return h.lag += g, h.hashSum = h.lag + "_" + h.link + "_" + h.source + "_" + h.target, h;
  };
}
var je = { second: 1, minute: 60, hour: 3600, day: 86400, week: 604800, month: 2592e3, quarter: 7776e3, year: 31536e3 };
function Q(e, n) {
  if (e.forEach) e.forEach(n);
  else for (var t = e.slice(), a = 0; a < t.length; a++) n(t[a], a);
}
function re(e, n) {
  if (e.includes) return e.includes(n);
  for (var t = 0; t < e.length; t++) if (e[t] === n) return !0;
  return !1;
}
function ce(e) {
  return Array.isArray ? Array.isArray(e) : e && e.length !== void 0 && e.pop && e.push;
}
function G(e) {
  return !(!e || typeof e != "object") && !!(e.getFullYear && e.getMonth && e.getDate);
}
function X(e) {
  return G(e) && !isNaN(e.getTime());
}
function K(e, n) {
  return Be(e) && !Be(n) && (e = "0"), e;
}
function Be(e) {
  return e === 0;
}
function Ue() {
  return { getVertices: function(e) {
    for (var n, t = {}, a = 0, s = e.length; a < s; a++) t[(n = e[a]).target] = n.target, t[n.source] = n.source;
    var i, o = [];
    for (var a in t) i = t[a], o.push(i);
    return o;
  }, topologicalSort: function(e) {
    for (var n = this.getVertices(e), t = {}, a = 0, s = n.length; a < s; a++) t[n[a]] = { id: n[a], $source: [], $target: [], $incoming: 0 };
    for (a = 0, s = e.length; a < s; a++) {
      var i = t[e[a].target];
      i.$target.push(a), i.$incoming = i.$target.length, t[e[a].source].$source.push(a);
    }
    for (var o = n.filter(function(u) {
      return !t[u].$incoming;
    }), l = []; o.length; ) {
      var r = o.pop();
      l.push(r);
      var d = t[r];
      for (a = 0; a < d.$source.length; a++) {
        var c = t[e[d.$source[a]].target];
        c.$incoming--, c.$incoming || o.push(c.id);
      }
    }
    return l;
  }, groupAdjacentEdges: function(e) {
    for (var n, t = {}, a = 0, s = e.length; a < s; a++) t[(n = e[a]).source] || (t[n.source] = []), t[n.source].push(n);
    return t;
  }, tarjanStronglyConnectedComponents: function(e, n) {
    for (var t = {}, a = [], s = this.groupAdjacentEdges(n), i = !1, o = [], l = 0; l < e.length; l++) {
      var r = p(e[l]);
      if (!r.visited) for (var d = [r], c = 0; d.length; ) {
        var u = d.pop();
        u.visited || (u.index = c, u.lowLink = c, c++, a.push(u), u.onStack = !0, u.visited = !0), i = !1, n = s[u.id] || [];
        for (var _ = 0; _ < n.length; _++) {
          var h = p(n[_].target);
          if (h.edge = n[_], h.index === void 0) {
            d.push(u), d.push(h), i = !0;
            break;
          }
          h.onStack && (u.lowLink = Math.min(u.lowLink, h.index));
        }
        if (!i) {
          if (u.index == u.lowLink) {
            for (var g = { tasks: [], links: [], linkKeys: [] }; (h = a.pop()).onStack = !1, g.tasks.push(h.id), h.edge && (g.links.push(h.edge.id), g.linkKeys.push(h.edge.hashSum)), h != u; ) ;
            o.push(g);
          }
          d.length && (h = u, (u = d[d.length - 1]).lowLink = Math.min(u.lowLink, h.lowLink));
        }
      }
    }
    return o;
    function p(k) {
      return t[k] || (t[k] = { id: k, onStack: !1, index: void 0, lowLink: void 0, edge: void 0 }), t[k];
    }
  }, findLoops: function(e) {
    var n = [];
    Q(e, function(a) {
      a.target == a.source && n.push({ tasks: [a.source], links: [a.id] });
    });
    var t = this.getVertices(e);
    return Q(this.tarjanStronglyConnectedComponents(t, e), function(a) {
      a.tasks.length > 1 && n.push(a);
    }), n;
  } };
}
function We(e) {
  return { getVirtualRoot: function() {
    return e.mixin(e.getSubtaskDates(), { id: e.config.root_id, type: e.config.types.project, $source: [], $target: [], $virtual: !0 });
  }, getLinkedTasks: function(n, t) {
    var a = [n], s = !1;
    e._isLinksCacheEnabled() || (e._startLinksCache(), s = !0);
    for (var i = [], o = {}, l = {}, r = 0; r < a.length; r++) this._getLinkedTasks(a[r], o, t, l);
    for (var r in l) i.push(l[r]);
    return s && e._endLinksCache(), i;
  }, _collectRelations: function(n, t, a, s) {
    var i, o = e._getSuccessors(n, t), l = [];
    a && (l = e._getPredecessors(n, t));
    for (var r = [], d = 0; d < o.length; d++) s[i = o[d].hashSum] || (s[i] = !0, r.push(o[d]));
    for (d = 0; d < l.length; d++) s[i = l[d].hashSum] || (s[i] = !0, r.push(l[d]));
    return r;
  }, _getLinkedTasks: function(n, t, a, s) {
    for (var i, o = n === void 0 ? e.config.root_id : n, l = (t = {}, {}), r = [{ from: o, includePredecessors: a, isChild: !1 }]; r.length; ) {
      var d = r.pop(), c = d.isChild;
      if (!t[o = d.from]) {
        i = e.isTaskExists(o) ? e.getTask(o) : this.getVirtualRoot(), t[o] = !0;
        for (var u = this._collectRelations(i, c, a, l), _ = 0; _ < u.length; _++) {
          var h = u[_];
          let k = !0;
          e._getAutoSchedulingConfig().use_progress && e.getTask(h.target).progress == 1 && (k = !1);
          const v = e.getTask(h.target), f = e.getTask(h.source);
          (v.unscheduled || f.unscheduled) && (k = !1), k && (s[h.hashSum] = h);
          var g = h.sourceParent == h.targetParent;
          t[h.target] || r.push({ from: h.target, includePredecessors: !0, isChild: g });
        }
        if (e.hasChild(i.id)) {
          var p = e.getChildren(i.id);
          for (_ = 0; _ < p.length; _++) t[p[_]] || r.push({ from: p[_], includePredecessors: !0, isChild: !0 });
        }
      }
    }
    return s;
  } };
}
var R = ((e) => (e.ASAP = "asap", e.ALAP = "alap", e.SNET = "snet", e.SNLT = "snlt", e.FNET = "fnet", e.FNLT = "fnlt", e.MSO = "mso", e.MFO = "mfo", e))(R || {});
class ee {
  static Create(n) {
    const t = new ee();
    if (n) for (const a in t) n[a] !== void 0 && (t[a] = n[a]);
    return t;
  }
  constructor() {
    this.link = null, this.task = null, this.start_date = null, this.end_date = null, this.latestStart = null, this.earliestStart = null, this.earliestEnd = null, this.latestEnd = null, this.latestSchedulingStart = null, this.earliestSchedulingStart = null, this.latestSchedulingEnd = null, this.earliestSchedulingEnd = null, this.kind = "asap", this.conflict = !1;
  }
}
class Ie {
  constructor(n) {
    this.isAsapTask = (t) => {
      const a = this.getConstraintType(t);
      return this._gantt._getAutoSchedulingConfig().schedule_from_end ? a === R.ASAP : a !== R.ALAP;
    }, this.isAlapTask = (t) => !this.isAsapTask(t), this.getConstraintType = (t) => {
      if (!this._gantt._isAutoSchedulable(t)) return;
      const a = this._getTaskConstraint(t), s = this._gantt._getAutoSchedulingConfig();
      return a.constraint_type ? a.constraint_type : s.schedule_from_end ? R.ALAP : R.ASAP;
    }, this._getTaskConstraint = (t) => {
      let a = this._getOwnConstraint(t);
      const s = this._gantt._getAutoSchedulingConfig();
      if (s.project_constraint && !this._gantt.getState().group_mode) {
        let i = R.ASAP;
        s.schedule_from_end && (i = R.ALAP), (a && a.constraint_type) !== i && a || (a = this._getParentConstraint(t));
      }
      return a;
    }, this._getOwnConstraint = (t) => ({ constraint_type: t.constraint_type, constraint_date: t.constraint_date }), this._getParentConstraint = (t) => {
      const a = this._gantt._getAutoSchedulingConfig();
      let s = R.ASAP;
      a.schedule_from_end && (s = R.ALAP);
      let i = { constraint_type: s, constraint_date: null };
      return this._gantt.eachParent((o) => {
        i.constraint_type === s && o.constraint_type && o.constraint_type !== s && (i = { constraint_type: o.constraint_type, constraint_date: o.constraint_date });
      }, t.id), i;
    }, this.hasConstraint = (t) => !!this.getConstraintType(t), this.processConstraint = (t, a) => {
      const s = this._getTaskConstraint(t);
      if (s && !(s.constraint_type === R.ALAP || s.constraint_type === R.ASAP)) {
        if (X(s.constraint_date)) {
          const i = s.constraint_date, o = ee.Create(a);
          switch (o.task = t.id, s.constraint_type) {
            case R.SNET:
              o.earliestStart = new Date(i), o.earliestEnd = this._gantt.calculateEndDate({ start_date: o.earliestStart, duration: t.duration, task: t }), o.link = null;
              break;
            case R.SNLT:
              o.latestStart = new Date(i), o.latestEnd = this._gantt.calculateEndDate({ start_date: o.latestStart, duration: t.duration, task: t }), o.link = null;
              break;
            case R.FNET:
              o.earliestStart = this._gantt.calculateEndDate({ start_date: i, duration: -t.duration, task: t }), o.earliestEnd = new Date(i), o.link = null;
              break;
            case R.FNLT:
              o.latestStart = this._gantt.calculateEndDate({ start_date: i, duration: -t.duration, task: t }), o.latestEnd = new Date(i), o.link = null;
              break;
            case R.MSO:
              o.earliestStart = new Date(i), o.earliestEnd = this._gantt.calculateEndDate({ start_date: o.earliestStart, duration: t.duration, task: t }), o.latestStart = o.earliestStart, o.latestEnd = o.earliestEnd, o.link = null;
              break;
            case R.MFO:
              o.earliestStart = this._gantt.calculateEndDate({ start_date: i, duration: -t.duration, task: t }), o.earliestEnd = this._gantt.calculateEndDate({ start_date: o.earliestStart, duration: t.duration, task: t }), o.latestStart = o.earliestStart, o.latestEnd = o.earliestEnd, o.link = null;
          }
          return o;
        }
      }
      return a;
    }, this.getConstraints = (t, a) => {
      const s = [], i = {}, o = (r) => {
        i[r.id] || this.hasConstraint(r) && !this._gantt.isSummaryTask(r) && (i[r.id] = r);
      };
      if (this._gantt.isTaskExists(t)) {
        const r = this._gantt.getTask(t);
        o(r);
      }
      let l;
      if (this._gantt.eachTask((r) => o(r), t), a) for (let r = 0; r < a.length; r++) {
        const d = a[r];
        i[d.target] || (l = this._gantt.getTask(d.target), o(l)), i[d.source] || (l = this._gantt.getTask(d.source), o(l));
      }
      for (const r in i) i[r].type !== this._gantt.config.types.placeholder && s.push(i[r]);
      return s;
    }, this._gantt = n;
  }
  static Create(n) {
    return new Ie(n);
  }
}
class tt {
  constructor(n) {
    this._gantt = n;
  }
  isEqual(n, t, a) {
    return !this._gantt._hasDuration(n, t, a);
  }
  isFirstSmaller(n, t, a) {
    return n.valueOf() < t.valueOf() && !this.isEqual(n, t, a);
  }
  isSmallerOrDefault(n, t, a) {
    return !(n && !this.isFirstSmaller(n, t, a));
  }
  isGreaterOrDefault(n, t, a) {
    return !(n && !this.isFirstSmaller(t, n, a));
  }
}
class Oe {
  static Create(n) {
    const t = new Oe();
    return t._gantt = n, t._comparator = new tt(n), t;
  }
  resolveRelationDate(n, t, a) {
    let s = null, i = null, o = null, l = null;
    const r = this._gantt.getTask(n), d = t.successors;
    let c = null;
    const u = a[n];
    for (let h = 0; h < d.length; h++) {
      const g = d[h];
      l = g.preferredStart;
      const p = this.getLatestEndDate(g, a, r), k = this._gantt.calculateEndDate({ start_date: p, duration: -r.duration, task: r });
      this._comparator.isGreaterOrDefault(c, p, r) && (c = p), this._comparator.isGreaterOrDefault(l, k, r) && this._comparator.isGreaterOrDefault(s, p, r) && (s = p, o = k, i = g.id);
    }
    !d.length && this._gantt.config.project_end && (this._comparator.isGreaterOrDefault(this._gantt.config.project_end, r.end_date, r) && (s = this._gantt.config.project_end), this._gantt.callEvent("onBeforeTaskAutoSchedule", [r, r.end_date]) === !1 && (s = r.end_date)), s && (r.duration ? (s = this._gantt.getClosestWorkTime({ date: s, dir: "future", task: r }), o = this._gantt.calculateEndDate({ start_date: s, duration: -r.duration, task: r })) : o = s = this._gantt.getClosestWorkTime({ date: s, dir: "past", task: r }));
    const _ = ee.Create(u);
    return _.link = i, _.task = n, _.end_date = s, _.start_date = o, _.kind = "alap", c && (_.latestSchedulingStart = this._gantt.calculateEndDate({ start_date: c, duration: -r.duration, task: r }), _.latestSchedulingEnd = c), _;
  }
  getSuccessorStartDate(n, t) {
    const a = t[n], s = this._gantt.getTask(n);
    let i;
    return i = a && (a.start_date || a.end_date) ? a.start_date ? a.start_date : this._gantt.calculateEndDate({ start_date: a.end_date, duration: -s.duration, task: s }) : s.start_date, i;
  }
  getLatestEndDate(n, t, a) {
    const s = this.getSuccessorStartDate(n.target, t), i = a;
    let o = this._gantt.getClosestWorkTime({ date: s, dir: "past", task: i });
    return o && n.lag && 1 * n.lag == 1 * n.lag && (o = this._gantt.calculateEndDate({ start_date: o, duration: 1 * -n.lag, task: i })), o;
  }
}
class Pe {
  static Create(n) {
    const t = new Pe();
    return t._gantt = n, t._comparator = new tt(n), t;
  }
  resolveRelationDate(n, t, a) {
    let s = null, i = null, o = null;
    const l = this._gantt.getTask(n), r = t.predecessors, d = this._gantt._getAutoSchedulingConfig(), c = {};
    let u = null;
    for (let p = 0; p < r.length; p++) {
      const k = r[p];
      o = k.preferredStart;
      const v = this.getEarliestStartDate(k, a, l);
      if (this._comparator.isSmallerOrDefault(u, v, l) && (u = v), this._comparator.isSmallerOrDefault(o, v, l) && this._comparator.isSmallerOrDefault(s, v, l) && (s = v, i = k.id), !l.duration) {
        const f = this._gantt.getLink(k.id);
        (c[f.type] === void 0 || c[f.type] < +v) && (c[f.type] = +v);
      }
    }
    !r.length && this._gantt.config.project_start && ((this._comparator.isSmallerOrDefault(l.start_date, this._gantt.config.project_start, l) || d.gap_behavior === "compress" && this._comparator.isGreaterOrDefault(l.start_date, this._gantt.config.project_start, l)) && (s = this._gantt.config.project_start), this._gantt.callEvent("onBeforeTaskAutoSchedule", [l, l.start_date]) === !1 && (s = l.start_date));
    let _ = null;
    if (s) if (l.duration) s = this._gantt.getClosestWorkTime({ date: s, dir: "future", task: l }), _ = this._gantt.calculateEndDate({ start_date: s, duration: l.duration, task: l });
    else {
      let p = "future";
      const k = this._gantt.config.links;
      if (c[k.finish_to_finish] !== void 0) {
        const v = r.length === 1;
        let f = !0;
        for (const y in c) if (y != k.finish_to_finish && c[k.finish_to_finish] < c[y]) {
          f = !1;
          break;
        }
        (v || f) && (p = "past");
      }
      s = _ = this._gantt.getClosestWorkTime({ date: s, dir: p, task: l });
    }
    const h = a[n], g = ee.Create(h);
    return g.link = i, g.task = n, g.start_date = s, g.end_date = _, g.kind = "asap", u && (g.earliestSchedulingStart = u, g.earliestSchedulingEnd = this._gantt.calculateEndDate({ start_date: u, duration: l.duration, task: l })), g;
  }
  getPredecessorEndDate(n, t) {
    const a = t[n], s = this._gantt.getTask(n);
    let i;
    return i = a && (a.start_date || a.end_date) ? a.end_date ? a.end_date : this._gantt.calculateEndDate({ start_date: a.start_date, duration: s.duration, task: s }) : s.end_date, i;
  }
  getEarliestStartDate(n, t, a) {
    const s = this.getPredecessorEndDate(n.source, t), i = a, o = this._gantt.getTask(n.source), l = this._gantt._getAutoSchedulingConfig();
    let r;
    if (s && n.lag && 1 * n.lag == 1 * n.lag) {
      let d = i;
      l.move_projects && n.subtaskLink && this._gantt.isTaskExists(n.targetParent) && (d = this._gantt.getTask(n.targetParent)), r = this._gantt.getClosestWorkTime({ date: s, dir: "future", task: o }), n.sourceLag && (r = this._gantt.calculateEndDate({ start_date: r, duration: 1 * n.sourceLag, task: o })), n.targetLag && (r = this._gantt.calculateEndDate({ start_date: r, duration: 1 * n.targetLag, task: d })), r = this._gantt.calculateEndDate({ start_date: r, duration: 1 * n.trueLag, task: d });
    } else {
      const d = this._gantt.getLink(n.id).type === this._gantt.config.links.finish_to_finish;
      r = !i.duration && d ? this._gantt.getClosestWorkTime({ date: s, dir: "past", task: i }) : this._gantt.getClosestWorkTime({ date: s, dir: "future", task: i });
    }
    return r;
  }
}
class ft {
  constructor(n, t, a) {
    this._secondIteration = !1, this._gantt = n, this._constraintsHelper = a, this._graphHelper = t, this._asapStrategy = Pe.Create(n), this._alapStrategy = Oe.Create(n), this._secondIterationRequired = !1;
  }
  generatePlan(n, t) {
    const a = this._graphHelper, s = this._gantt, i = this._constraintsHelper, o = this._alapStrategy, l = this._asapStrategy, r = s._getAutoSchedulingConfig(), { orderedIds: d, reversedIds: c, relationsMap: u, plansHash: _ } = this.buildWorkCollections(n, t, a);
    let h;
    return this.processConstraints(d, _, s, i), h = r.schedule_from_end ? this.iterateTasks(c, d, i.isAlapTask, o, l, u, _) : this.iterateTasks(d, c, i.isAsapTask, l, o, u, _), h;
  }
  applyProjectPlan(n) {
    const t = this._gantt;
    let a, s, i, o;
    const l = [];
    for (let r = 0; r < n.length; r++) {
      if (i = null, o = null, a = n[r], !t.isTaskExists(a.task)) continue;
      s = t.getTask(a.task), a.link && (i = t.getLink(a.link), o = a.kind === "asap" ? this._gantt.getTask(i.source) : this._gantt.getTask(i.target));
      let d = null;
      a.start_date && s.start_date.valueOf() !== a.start_date.valueOf() && (d = a.start_date), d && (s.start_date = d, s.end_date = t.calculateEndDate(s), l.push(s.id), t.callEvent("onAfterTaskAutoSchedule", [s, d, i, o]));
    }
    return l;
  }
  iterateTasks(n, t, a, s, i, o, l) {
    const r = this._gantt, d = [];
    for (let c = 0; c < n.length; c++) {
      const u = n[c], _ = r.getTask(u);
      if (!r._isAutoSchedulable(_)) continue;
      const h = s.resolveRelationDate(u, o[u], l);
      this.limitPlanDates(_, h), a(_) ? this.processResolvedDate(_, h, d, l) : l[_.id] = h;
    }
    for (let c = 0; c < t.length; c++) {
      const u = t[c], _ = r.getTask(u);
      if (r._isAutoSchedulable(_) && !a(_)) {
        const h = i.resolveRelationDate(u, o[u], l);
        this.limitPlanDates(_, h), this.processResolvedDate(_, h, d, l);
      }
    }
    if (this._secondIterationRequired) {
      if (this._secondIteration) this._secondIteration = !1;
      else if (this._secondIteration = !0, this.summaryLagChanged(r, o, l)) return this.iterateTasks(n, t, a, s, i, o, l);
    }
    return d;
  }
  summaryLagChanged(n, t, a) {
    const s = {}, i = {};
    for (const l in t) t[l].predecessors.forEach((r) => {
      if (r.subtaskLink) {
        const d = n.getLink(r.id);
        this.getProjectUpdates(n, a, r, d, "source", s, i), this.getProjectUpdates(n, a, r, d, "target", s, i);
      }
    });
    let o = !1;
    for (const l in s) {
      const r = s[l];
      if (!r.min || !r.max) continue;
      const d = n.getTask(l), c = n.calculateDuration({ start_date: d.start_date, end_date: d.end_date, task: d }), u = n.calculateDuration({ start_date: r.min, end_date: r.max, task: d });
      u !== c && (d.start_date = r.min, d.end_date = r.max, d.duration = u);
    }
    for (const l in i) {
      const r = i[l];
      let d, c;
      const u = s[r.source], _ = s[r.target];
      u && (d = { start_date: u.start_date, end_date: u.end_date }), _ && (d = { start_date: _.start_date, end_date: _.end_date }), n._formatLink(r, d, c).forEach(function(h) {
        for (const g in t) t[g].predecessors.forEach(function(p) {
          const k = p.id === h.id, v = p.target === h.target, f = p.source === h.source;
          k && v && f && (p.lag = h.lag, p.sourceLag = h.sourceLag, p.targetLag = h.targetLag, p.hashSum = h.hashSum);
        });
      }), o = !0;
    }
    return o;
  }
  getProjectUpdates(n, t, a, s, i, o, l) {
    if (n.getTask(s[i]).type === n.config.types.project) {
      o[s[i]] = o[s[i]] || { id: s[i], link: s };
      const r = o[s[i]];
      let d = t[a[i]];
      d && (i != "source" || d.start_date && d.end_date || (d = n.getTask(d.task)), r.min = r.min || d.start_date, r.min > d.start_date && (r.min = d.start_date), r.max = r.max || d.end_date, r.max < d.end_date && (r.max = d.end_date), l[s.id] = s);
    }
  }
  processResolvedDate(n, t, a, s) {
    if (t.start_date && this._gantt.isLinkExists(t.link)) {
      let i = null, o = null;
      if (t.link && (i = this._gantt.getLink(t.link), o = t.kind === "asap" ? this._gantt.getTask(i.source) : this._gantt.getTask(i.target)), n.start_date.valueOf() !== t.start_date.valueOf() && this._gantt.callEvent("onBeforeTaskAutoSchedule", [n, t.start_date, i, o]) === !1) return;
    }
    s[n.id] = t, t.start_date && a.push(t);
  }
  limitPlanDates(n, t) {
    const a = t.start_date || n.start_date;
    return t.earliestStart && a < t.earliestStart && (t.start_date = t.earliestStart, t.end_date = t.earliestEnd), t.latestStart && a > t.latestStart && (t.start_date = t.latestStart, t.end_date = t.latestEnd), t.latestSchedulingStart && a > t.latestSchedulingStart && (t.start_date = t.latestSchedulingStart, t.end_date = t.latestSchedulingEnd), t.earliestSchedulingStart && a < t.earliestSchedulingStart && (t.start_date = t.earliestSchedulingStart, t.end_date = t.earliestSchedulingEnd), t.start_date && (t.start_date > t.latestSchedulingStart || t.start_date < t.earliestSchedulingStart || t.start_date > t.latestStart || t.start_date < t.earliestStart || t.end_date > t.latestSchedulingEnd || t.end_date < t.earliestSchedulingEnd || t.end_date > t.latestEnd || t.end_date < t.earliestEnd) && (t.conflict = !0), t;
  }
  buildWorkCollections(n, t, a) {
    const s = this._gantt, i = a.topologicalSort(n), o = i.slice().reverse(), l = {}, r = {};
    for (let d = 0, c = i.length; d < c; d++) {
      const u = i[d], _ = s.getTask(u);
      s._isAutoSchedulable(_) && (r[u] = { successors: [], predecessors: [] }, l[u] = null);
    }
    for (let d = 0, c = t.length; d < c; d++) {
      const u = t[d];
      l[u.id] === void 0 && (o.unshift(u.id), i.unshift(u.id), l[u.id] = null, r[u.id] = { successors: [], predecessors: [] });
    }
    for (let d = 0, c = n.length; d < c; d++) {
      const u = n[d];
      r[u.source] && r[u.source].successors.push(u), r[u.target] && r[u.target].predecessors.push(u);
    }
    return { orderedIds: i, reversedIds: o, relationsMap: r, plansHash: l };
  }
  processConstraints(n, t, a, s) {
    for (let i = 0; i < n.length; i++) {
      const o = n[i], l = a.getTask(o), r = s.getConstraintType(l);
      if (r && r !== R.ASAP && r !== R.ALAP) {
        const d = s.processConstraint(l, ee.Create());
        t[l.id] = d;
      }
    }
  }
}
function me(e, n, t) {
  const a = [e], s = [], i = {}, o = {};
  let l;
  for (; a.length > 0; ) if (l = a.shift(), !t[l]) {
    t[l] = !0, s.push(l);
    for (let c = 0; c < n.length; c++) {
      const u = n[c];
      u.source == l || u.sourceParent == l ? (t[u.target] || (a.push(u.target), o[u.id] = !0, n.splice(c, 1), c--), i[u.hashSum] = u) : u.target != l && u.targetParent != l || (t[u.source] || (a.push(u.source), o[u.id] = !0, n.splice(c, 1), c--), i[u.hashSum] = u);
    }
  }
  const r = [];
  let d = [];
  for (const c in o) r.push(c);
  for (const c in i) d.push(i[c]);
  return d.length || (d = n), { tasks: s, links: r, processedLinks: d };
}
class pt {
  constructor(n, t) {
    this.getConnectedGroupRelations = (a) => me(a, this._linksBuilder.getLinkedTasks(), {}).processedLinks, this.getConnectedGroup = (a) => {
      const s = this._linksBuilder.getLinkedTasks();
      if (a !== void 0) {
        if (this._gantt.getTask(a).type === this._gantt.config.types.project) return { tasks: [], links: [] };
        const i = me(a, s, {});
        return { tasks: i.tasks, links: i.links };
      }
      return function(i) {
        const o = {}, l = [];
        let r, d, c;
        for (let u = 0; u < i.length; u++) if (r = i[u].source, d = i[u].target, c = null, o[r] ? o[d] || (c = d) : c = r, c) {
          const _ = i.length;
          l.push(me(c, i, o)), _ !== i.length && (u = -1);
        }
        return l;
      }(s).map((i) => ({ tasks: i.tasks, links: i.links }));
    }, this._linksBuilder = t, this._gantt = n;
  }
}
class mt {
  constructor(n, t, a) {
    this.isCircularLink = (s) => !!this.getLoopContainingLink(s), this.getLoopContainingLink = (s) => {
      const i = this._graphHelper, o = this._linksBuilder, l = this._gantt;
      let r = o.getLinkedTasks();
      l.isLinkExists(s.id) || (r = r.concat(l._formatLink(s)));
      const d = i.findLoops(r);
      for (let c = 0; c < d.length; c++) {
        const u = d[c].links;
        for (let _ = 0; _ < u.length; _++) if (u[_] == s.id) return d[c];
      }
      return null;
    }, this.findCycles = () => {
      const s = this._graphHelper, i = this._linksBuilder.getLinkedTasks();
      return s.findLoops(i);
    }, this._linksBuilder = a, this._graphHelper = t, this._gantt = n;
  }
}
function nt(e) {
  function n() {
    return { enabled: !1, apply_constraints: !1, gap_behavior: "preserve", descendant_links: !1, schedule_on_parse: !0, move_projects: !0, use_progress: !1, schedule_from_end: !1, project_constraint: !1, show_constraints: !1 };
  }
  return { getDefaultAutoSchedulingConfig: n, getAutoSchedulingConfig: function() {
    const t = e.config;
    if (typeof t.auto_scheduling == "object") {
      const a = { enabled: !1, apply_constraints: !1, gap_behavior: "preserve", descendant_links: !1, schedule_on_parse: !0, move_projects: !0, use_progress: !1, schedule_from_end: !1, project_constraint: !1, show_constraints: !1, ...t.auto_scheduling };
      return a.mode && (a.apply_constraints = a.mode === "constraints", delete a.mode), a.strict !== void 0 && (a.gap_behavior = a.strict ? "compress" : "preserve", delete a.strict), a.move_asap_tasks !== void 0 && (a.gap_behavior = a.move_asap_tasks ? "compress" : "preserve", delete a.move_asap_tasks), a;
    }
    return { enabled: !1, apply_constraints: !1, gap_behavior: "preserve", descendant_links: !1, schedule_on_parse: !0, move_projects: !0, use_progress: !1, schedule_from_end: !1, project_constraint: !1, show_constraints: !1, enabled: !!t.auto_scheduling, apply_constraints: t.auto_scheduling_compatibility ?? !1, gap_behavior: t.auto_scheduling_strict !== !0 ? "preserve" : "compress", descendant_links: t.auto_scheduling_descendant_links ?? !1, schedule_on_parse: t.auto_scheduling_initial ?? !0, move_projects: t.auto_scheduling_move_projects ?? !0, use_progress: t.auto_scheduling_use_progress ?? !1, schedule_from_end: t.schedule_from_end ?? !1, project_constraint: t.auto_scheduling_project_constraint ?? !1, show_constraints: !1 };
  } };
}
function kt(e, n, t, a) {
  const s = function() {
    let i, o, l = !1;
    function r(b, T) {
      e._getAutoSchedulingConfig().enabled && !e._autoscheduling_in_progress && (e.getState().batch_update ? l = !0 : e.autoSchedule(T.source));
    }
    function d(b, T) {
      const x = e._getAutoSchedulingConfig().use_progress, w = e.config.auto_scheduling_use_progress;
      return w ? e.config.auto_scheduling_use_progress = !1 : x && (e.config.auto_scheduling.use_progress = !1), e.isCircularLink(T) ? (e.callEvent("onCircularLinkError", [T, t.getLoopContainingLink(T)]), w ? e.config.auto_scheduling_use_progress = x : x && (e.config.auto_scheduling.use_progress = x), !1) : (w ? e.config.auto_scheduling_use_progress = x : x && (e.config.auto_scheduling.use_progress = x), !0);
    }
    function c(b, T) {
      const x = e.getTask(T.source), w = e.getTask(T.target);
      return !(!e._getAutoSchedulingConfig().descendant_links && (e.isChildOf(x.id, w.id) && e.isSummaryTask(w) || e.isChildOf(w.id, x.id) && e.isSummaryTask(x)));
    }
    function u(b, T, x, w) {
      return !!b != !!T || !(!b && !T) && (b.valueOf() > T.valueOf() ? e._hasDuration({ start_date: T, end_date: b, task: w }) : e._hasDuration({ start_date: b, end_date: T, task: x }));
    }
    function _(b, T) {
      return !!u(b.start_date, T.start_date, b, T) || e.getConstraintType(b) !== e.getConstraintType(T) || !!u(b.constraint_date, T.constraint_date, b, T) || !(!u(b.start_date, T.start_date, b, T) && (!u(b.end_date, T.end_date, b, T) && b.duration === T.duration || b.type === e.config.types.milestone)) || void 0;
    }
    function h(b) {
      return e._getAutoSchedulingConfig().apply_constraints ? a.getConnectedGroupRelations(b) : n.getLinkedTasks(b, !0);
    }
    function g(b, T) {
      let x = !1;
      for (let w = 0; w < i.length; w++) {
        const E = e.getLink(T[w].id);
        !E || E.type !== e.config.links.start_to_start && E.type !== e.config.links.start_to_finish || (T.splice(w, 1), w--, x = !0);
      }
      if (x) {
        const w = {};
        for (let $ = 0; $ < T.length; $++) w[T[$].id] = !0;
        const E = h(b);
        for (let $ = 0; $ < E.length; $++) w[E[$].id] || T.push(E[$]);
      }
    }
    function p(b, T) {
      if (e._getAutoSchedulingConfig().schedule_from_end) {
        if (T.end_date && b.end_date && b.end_date.valueOf() === T.end_date.valueOf()) return !0;
      } else if (T.start_date && b.start_date && b.start_date.valueOf() === T.start_date.valueOf()) return !0;
    }
    function k(b) {
      if (b.auto_scheduling === !1) return;
      const T = e._getAutoSchedulingConfig(), x = e.config.constraint_types, w = [x.SNLT, x.FNLT, x.MSO, x.MFO], E = [x.SNET, x.FNET, x.MSO, x.MFO];
      T.schedule_from_end ? w.indexOf(b.constraint_type) > -1 ? b.constraint_type == x.SNLT || b.constraint_type == x.MSO ? b.constraint_date = new Date(b.start_date) : b.constraint_date = new Date(b.end_date) : (b.constraint_type = x.FNLT, b.constraint_date = new Date(b.end_date)) : E.indexOf(b.constraint_type) > -1 ? b.constraint_type == x.SNET || b.constraint_type == x.MSO ? b.constraint_date = new Date(b.start_date) : b.constraint_date = new Date(b.end_date) : (b.constraint_type = x.SNET, b.constraint_date = new Date(b.start_date));
    }
    function v(b) {
      e._getAutoSchedulingConfig().apply_constraints || (b.constraint_type = null, b.constraint_date = null);
    }
    e.attachEvent("onAfterBatchUpdate", function() {
      l && e.autoSchedule(), l = !1;
    }), e.attachEvent("onAfterLinkUpdate", r), e.attachEvent("onAfterLinkAdd", r), e.attachEvent("onAfterLinkDelete", function(b, T) {
      if (e._getAutoSchedulingConfig().enabled && !e._autoscheduling_in_progress && e.isTaskExists(T.target)) {
        const x = e.getTask(T.target), w = e._getPredecessors(x);
        w.length && (e.getState().batch_update ? l = !0 : e.autoSchedule(w[0].source, !1));
      }
    }), e.attachEvent("onParse", function() {
      const b = e._getAutoSchedulingConfig();
      b.enabled && b.schedule_on_parse && e.autoSchedule();
    }), e.attachEvent("onBeforeLinkAdd", d), e.attachEvent("onBeforeLinkAdd", c), e.attachEvent("onBeforeLinkUpdate", d), e.attachEvent("onBeforeLinkUpdate", c), e.attachEvent("onBeforeTaskDrag", function(b, T, x) {
      return e._getAutoSchedulingConfig().enabled && (e.getState().drag_mode !== "progress" && (i = h(b)), o = b), !0;
    });
    const f = function(b, T) {
      const x = e.getTask(b);
      p(x, T) || k(x);
    };
    let y, m = null;
    if (e.ext && e.ext.inlineEditors) {
      const b = e.ext.inlineEditors, T = { start_date: !0, end_date: !0, duration: !0, constraint_type: !0, constraint_date: !0 };
      b.attachEvent("onBeforeSave", function(x) {
        if (T[x.columnName]) {
          const w = e._getAutoSchedulingConfig();
          m = x.id, x.columnName === "constraint_type" && (y = !0);
          const E = x.columnName === "duration", $ = w.schedule_from_end && x.columnName === "start_date", A = !w.schedule_from_end && x.columnName === "end_date", D = e.config.inline_editors_date_processing !== "keepDuration" && ($ || A), L = x.columnName === "constraint_date";
          (E || D || L) && (e.getTask(x.id).$keep_constraints = !0);
        }
        return !0;
      });
    }
    const S = {};
    let C;
    e.attachEvent("onBeforeTaskChanged", function(b, T, x) {
      return f(b, x), S[b] = x, !0;
    }), e.attachEvent("onAfterTaskDrag", function(b, T, x) {
      b === o && (clearTimeout(C), C = setTimeout(function() {
        (function(w, E) {
          const $ = e._getAutoSchedulingConfig();
          if ($.enabled && !e._autoscheduling_in_progress) {
            const A = e.getTask(w), D = $.use_progress && E.progress === 1 != (A.progress === 1);
            if (_(E, A)) {
              if (f(w, E), $.move_projects && o == w) {
                let L = !0;
                e.calculateDuration(E) !== e.calculateDuration(A) && (g(w, i), L = !1), D ? e.autoSchedule() : (L && g(w, i), e._autoSchedule(w, i));
              } else e.autoSchedule(A.id);
              v(A);
            }
          }
          i = null, o = null;
        })(b, S[b]);
      }));
    }), e.ext.inlineEditors && e.ext.inlineEditors.attachEvent("onBeforeSave", function(b) {
      if (e._getAutoSchedulingConfig().enabled && !e._autoscheduling_in_progress) {
        const T = e.ext.inlineEditors.getEditorConfig(b.columnName);
        !T || T.map_to !== "start_date" && T.map_to !== "end_date" && T.map_to !== "duration" || (m = b.id);
      }
      return !0;
    }), e.attachEvent("onLightboxSave", function(b, T) {
      if (e._getAutoSchedulingConfig().enabled && !e._autoscheduling_in_progress) {
        y = !1;
        const x = e.getTask(b);
        _(T, x) && (m = b, p(T, x) && (T.$keep_constraints = !0), e.getConstraintType(T) === e.getConstraintType(x) && +T.constraint_date == +x.constraint_date || (y = !0));
      }
      return !0;
    }), e.attachEvent("onAfterTaskUpdate", function(b, T) {
      return e._getAutoSchedulingConfig().enabled && !e._autoscheduling_in_progress && m !== null && m == b && (m = null, T.$keep_constraints ? delete T.$keep_constraints : y || k(T), e.autoSchedule(T.id), y || v(T)), !0;
    });
  };
  e.attachEvent("onGanttReady", function() {
    s();
  }, { once: !0 });
}
var ke, vt = {}.constructor.toString();
function J(e) {
  var n, t;
  if (e && typeof e == "object") switch (!0) {
    case G(e):
      t = new Date(e);
      break;
    case ce(e):
      for (t = new Array(e.length), n = 0; n < e.length; n++) t[n] = J(e[n]);
      break;
    default:
      if (function(a) {
        return a.constructor.toString() !== vt;
      }(e)) t = Object.create(e);
      else {
        if (function(a) {
          return a.$$typeof && a.$$typeof.toString().includes("react.");
        }(e)) return t = e;
        t = {};
      }
      for (n in e) Object.prototype.hasOwnProperty.apply(e, [n]) && (t[n] = J(e[n]));
  }
  return t || e;
}
function B(e, n, t) {
  for (var a in n) (e[a] === void 0 || t) && (e[a] = n[a]);
  return e;
}
function j(e) {
  return e !== void 0;
}
function se() {
  return ke || (ke = (/* @__PURE__ */ new Date()).valueOf()), ++ke;
}
function O(e, n) {
  return e.bind ? e.bind(n) : function() {
    return e.apply(n, arguments);
  };
}
const yt = Object.freeze(Object.defineProperty({ __proto__: null, bind: O, copy: J, defined: j, event: function(e, n, t, a) {
  e.addEventListener ? e.addEventListener(n, t, a !== void 0 && a) : e.attachEvent && e.attachEvent("on" + n, t);
}, eventRemove: function(e, n, t, a) {
  e.removeEventListener ? e.removeEventListener(n, t, a !== void 0 && a) : e.detachEvent && e.detachEvent("on" + n, t);
}, mixin: B, uid: se }, Symbol.toStringTag, { value: "Module" }));
function at(e) {
  var n = e.date;
  return e.$services, { getSum: function(t, a, s) {
    s === void 0 && (s = t.length - 1), a === void 0 && (a = 0);
    for (var i = 0, o = a; o <= s; o++) i += t[o];
    return i;
  }, setSumWidth: function(t, a, s, i) {
    var o = a.width;
    i === void 0 && (i = o.length - 1), s === void 0 && (s = 0);
    var l = i - s + 1;
    if (!(s > o.length - 1 || l <= 0 || i > o.length - 1)) {
      var r = t - this.getSum(o, s, i);
      this.adjustSize(r, o, s, i), this.adjustSize(-r, o, i + 1), a.full_width = this.getSum(o);
    }
  }, splitSize: function(t, a) {
    for (var s = [], i = 0; i < a; i++) s[i] = 0;
    return this.adjustSize(t, s), s;
  }, adjustSize: function(t, a, s, i) {
    s || (s = 0), i === void 0 && (i = a.length - 1);
    for (var o = i - s + 1, l = this.getSum(a, s, i), r = s; r <= i; r++) {
      var d = Math.floor(t * (l ? a[r] / l : 1 / o));
      l -= a[r], t -= d, o--, a[r] += d;
    }
    a[a.length - 1] += t;
  }, sortScales: function(t) {
    function a(i, o) {
      var l = new Date(1970, 0, 1);
      return n.add(l, o, i) - l;
    }
    t.sort(function(i, o) {
      return a(i.unit, i.step) < a(o.unit, o.step) ? 1 : a(i.unit, i.step) > a(o.unit, o.step) ? -1 : 0;
    });
    for (var s = 0; s < t.length; s++) t[s].index = s;
  }, _prepareScaleObject: function(t) {
    var a = t.format;
    return a || (a = t.template || t.date || "%d %M"), typeof a == "string" && (a = e.date.date_to_str(a)), { unit: t.unit || "day", step: t.step || 1, format: a, css: t.css, projection: t.projection || null, column_width: t.column_width || null };
  }, primaryScale: function(t) {
    const a = (t || e.config).scales[0], s = { unit: a.unit, step: a.step, template: a.template, format: a.format, date: a.date, css: a.css || e.templates.scale_cell_class, projection: a.projection || null, column_width: a.column_width || null };
    return this._prepareScaleObject(s);
  }, getAdditionalScales: function(t) {
    return (t || e.config).scales.slice(1).map((function(a) {
      return this._prepareScaleObject(a);
    }).bind(this));
  }, prepareConfigs: function(t, a, s, i, o, l, r) {
    for (var d = this.splitSize(i, t.length), c = s, u = [], _ = t.length - 1; _ >= 0; _--) {
      var h = _ == t.length - 1, g = this.initScaleConfig(t[_], o, l);
      h && this.processIgnores(g), h && g.column_width && (c = g.column_width * (g.display_count || g.count)), this.initColSizes(g, a, c, d[_]), this.limitVisibleRange(g), h && (c = g.full_width), u.unshift(g);
    }
    for (_ = 0; _ < u.length - 1; _++) this.alineScaleColumns(u[u.length - 1], u[_]);
    for (_ = 0; _ < u.length; _++) r && this.reverseScale(u[_]), this.setPosSettings(u[_]);
    return u;
  }, reverseScale: function(t) {
    t.width = t.width.reverse(), t.trace_x = t.trace_x.reverse();
    var a = t.trace_indexes;
    t.trace_indexes = {}, t.trace_index_transition = {}, t.rtl = !0;
    for (var s = 0; s < t.trace_x.length; s++) t.trace_indexes[t.trace_x[s].valueOf()] = s, t.trace_index_transition[a[t.trace_x[s].valueOf()]] = s;
    return t;
  }, setPosSettings: function(t) {
    for (var a = 0, s = t.trace_x.length; a < s; a++) t.left.push((t.width[a - 1] || 0) + (t.left[a - 1] || 0));
  }, _ignore_time_config: function(t, a) {
    if (e.config.skip_off_time) {
      for (var s = !0, i = t, o = 0; o < a.step; o++) o && (i = n.add(t, o, a.unit)), s = s && !this.isWorkTime(i, a.unit);
      return s;
    }
    return !1;
  }, processIgnores: function(t) {
    t.ignore_x = {}, t.display_count = t.count;
  }, initColSizes: function(t, a, s, i) {
    var o = s;
    t.height = i;
    var l = t.display_count === void 0 ? t.count : t.display_count;
    l || (l = 1);
    const r = !isNaN(1 * t.column_width) && 1 * t.column_width > 0;
    if (r) {
      const _ = 1 * t.column_width;
      t.col_width = _, o = _ * l;
    } else t.col_width = Math.floor(o / l), a && t.col_width < a && (t.col_width = a, o = t.col_width * l);
    t.width = [];
    for (var d = t.ignore_x || {}, c = 0; c < t.trace_x.length; c++) if (d[t.trace_x[c].valueOf()] || t.display_count == t.count) t.width[c] = r ? t.col_width : 0;
    else {
      var u = 1;
      t.unit == "month" && (u = Math.round((n.add(t.trace_x[c], t.step, t.unit) - t.trace_x[c]) / 864e5)), t.width[c] = u;
    }
    r || this.adjustSize(o - this.getSum(t.width), t.width), t.full_width = this.getSum(t.width);
  }, initScaleConfig: function(t, a, s) {
    var i = B({ count: 0, col_width: 0, full_width: 0, height: 0, width: [], left: [], trace_x: [], trace_indexes: {}, min_date: new Date(a), max_date: new Date(s) }, t);
    return this.eachColumn(t.unit, t.step, a, s, function(o) {
      i.count++, i.trace_x.push(new Date(o)), i.trace_indexes[o.valueOf()] = i.trace_x.length - 1;
    }), i.trace_x_ascending = i.trace_x.slice(), i;
  }, iterateScales: function(t, a, s, i, o) {
    for (var l = a.trace_x, r = t.trace_x, d = s || 0, c = i || r.length - 1, u = 0, _ = 1; _ < l.length; _++) {
      var h = t.trace_indexes[+l[_]];
      h !== void 0 && h <= c && (o && o.apply(this, [u, _, d, h]), d = h, u = _);
    }
  }, alineScaleColumns: function(t, a, s, i) {
    this.iterateScales(t, a, s, i, function(o, l, r, d) {
      var c = this.getSum(t.width, r, d - 1);
      this.getSum(a.width, o, l - 1) != c && this.setSumWidth(c, a, o, l - 1);
    });
  }, eachColumn: function(t, a, s, i, o) {
    var l = new Date(s), r = new Date(i);
    n[t + "_start"] && (l = n[t + "_start"](l));
    var d = new Date(l);
    for (+d >= +r && (r = n.add(d, a, t)); +d < +r; ) {
      o.call(this, new Date(d));
      var c = d.getTimezoneOffset();
      d = n.add(d, a, t), d = e._correct_dst_change(d, c, a, t), n[t + "_start"] && (d = n[t + "_start"](d));
    }
  }, limitVisibleRange: function(t) {
    var a = t.trace_x, s = t.width.length - 1, i = 0;
    if (+a[0] < +t.min_date && s != 0) {
      var o = Math.floor(t.width[0] * ((a[1] - t.min_date) / (a[1] - a[0])));
      i += t.width[0] - o, t.width[0] = o, a[0] = new Date(t.min_date);
    }
    var l = a.length - 1, r = a[l], d = n.add(r, t.step, t.unit);
    if (+d > +t.max_date && l > 0 && (o = t.width[l] - Math.floor(t.width[l] * ((d - t.max_date) / (d - r))), i += t.width[l] - o, t.width[l] = o), i) {
      for (var c = this.getSum(t.width), u = 0, _ = 0; _ < t.width.length; _++) {
        var h = Math.floor(i * (t.width[_] / c));
        t.width[_] += h, u += h;
      }
      this.adjustSize(i - u, t.width);
    }
  } };
}
function st(e) {
  var n = new at(e);
  return n.processIgnores = function(t) {
    var a = t.count;
    if (t.ignore_x = {}, e.ignore_time || e.config.skip_off_time) {
      var s = e.ignore_time || function() {
        return !1;
      };
      a = 0;
      for (var i = 0; i < t.trace_x.length; i++) s.call(e, t.trace_x[i]) || this._ignore_time_config.call(e, t.trace_x[i], t) ? (t.ignore_x[t.trace_x[i].valueOf()] = !0, t.ignored_colls = !0) : a++;
    }
    t.display_count = a;
  }, n;
}
function bt(e) {
  return e.ext = e.ext || {}, e.ext.export_api = e.ext.export_api || { _apiUrl: "https://export.dhtmlx.com/gantt", _preparePDFConfigRaw(n, t) {
    let a = null;
    n.start && n.end && (a = { start_date: e.config.start_date, end_date: e.config.end_date }, e.config.start_date = e.date.str_to_date(e.config.date_format)(n.start), e.config.end_date = e.date.str_to_date(e.config.date_format)(n.end)), n = e.mixin(n, { name: "gantt." + t, data: e.ext.export_api._serializeHtml() }), a && (e.config.start_date = a.start_date, e.config.end_date = a.end_date);
  }, _prepareConfigPDF: (n, t) => (n = e.mixin(n || {}, { name: "gantt." + t, data: e.ext.export_api._serializeAll(), config: e.config }), e.ext.export_api._fixColumns(n.config.columns), n), _pdfExportRouter(n, t) {
    n && n.raw ? e.ext.export_api._preparePDFConfigRaw(n, t) : n = e.ext.export_api._prepareConfigPDF(n, t), n.version = e.version, e.ext.export_api._sendToExport(n, t);
  }, exportToPDF(n) {
    e.ext.export_api._pdfExportRouter(n, "pdf");
  }, exportToPNG(n) {
    e.ext.export_api._pdfExportRouter(n, "png");
  }, exportToICal(n) {
    n = e.mixin(n || {}, { name: "gantt.ical", data: e.ext.export_api._serializePlain().data, version: e.version }), e.ext.export_api._sendToExport(n, "ical");
  }, exportToExcel(n) {
    let t;
    n = n || {};
    let a, s, i = [];
    const o = e.config.smart_rendering;
    if (n.visual === "base-colors" && (e.config.smart_rendering = !1), n.start || n.end) {
      a = e.getState(), i = [e.config.start_date, e.config.end_date], s = e.getScrollState();
      const l = e.date.str_to_date(e.config.date_format);
      t = e.eachTask, n.start && (e.config.start_date = l(n.start)), n.end && (e.config.end_date = l(n.end)), e.render(), e.config.smart_rendering = o, e.eachTask = e.ext.export_api._eachTaskTimed(e.config.start_date, e.config.end_date);
    } else n.visual === "base-colors" && (e.render(), e.config.smart_rendering = o);
    (n = e.mixin(n, { name: "gantt.xlsx", title: "Tasks", data: e.ext.export_api._serializeTimeline(n), columns: e.ext.export_api._serializeGrid({ raw: n.raw, rawDates: !0 }), version: e.version })).visual && (n.scales = e.ext.export_api._serializeScales(n)), e.ext.export_api._sendToExport(n, "excel"), (n.start || n.end) && (e.config.start_date = a.min_date, e.config.end_date = a.max_date, e.eachTask = t, e.render(), e.scrollTo(s.x, s.y), e.config.start_date = i[0], e.config.end_date = i[1]);
  }, exportToJSON(n) {
    n = e.mixin(n || {}, { name: "gantt.json", data: e.ext.export_api._serializeAll(), config: e.config, columns: e.ext.export_api._serializeGrid(), worktime: e.ext.export_api._getWorktimeSettings(), version: e.version }), e.ext.export_api._sendToExport(n, "json");
  }, importFromExcel(n) {
    try {
      const t = n.data;
      if (t instanceof File) {
        const a = new FormData();
        a.append("file", t), n.data = a;
      }
    } catch {
    }
    e.ext.export_api._sendImportAjaxExcel(n);
  }, importFromMSProject(n) {
    const t = n.data;
    try {
      if (t instanceof File) {
        const a = new FormData();
        a.append("file", t), n.data = a;
      }
    } catch {
    }
    e.ext.export_api._sendImportAjaxMSP(n);
  }, importFromPrimaveraP6: (n) => (n.type = "primaveraP6-parse", e.importFromMSProject(n)), exportToMSProject(n) {
    (n = n || {}).skip_circular_links = n.skip_circular_links === void 0 || !!n.skip_circular_links;
    const t = e.templates.xml_format, a = e.templates.format_date, s = e.config.xml_date, i = e.config.date_format, o = "%d-%m-%Y %H:%i:%s";
    e.config.xml_date = o, e.config.date_format = o, e.templates.xml_format = e.date.date_to_str(o), e.templates.format_date = e.date.date_to_str(o);
    const l = e.ext.export_api._serializeAll();
    e.ext.export_api._customProjectProperties(l, n), e.ext.export_api._customTaskProperties(l, n), n.skip_circular_links && e.ext.export_api._clearRecLinks(l), n = e.ext.export_api._exportConfig(l, n), e.ext.export_api._sendToExport(n, n.type || "msproject"), e.config.xml_date = s, e.config.date_format = i, e.templates.xml_format = t, e.templates.format_date = a, e.config.$custom_data = null, e.config.custom = null;
  }, exportToPrimaveraP6: (n) => ((n = n || {}).type = "primaveraP6", e.exportToMSProject(n)), _fixColumns(n) {
    for (let t = 0; t < n.length; t++) n[t].label = n[t].label || e.locale.labels["column_" + n[t].name], typeof n[t].width == "string" && (n[t].width = 1 * n[t].width);
  }, _xdr(n, t, a) {
    e.ajax.post(n, t, a);
  }, _markColumns(n) {
    const t = n.config.columns;
    if (t) for (let a = 0; a < t.length; a++) t[a].template && (t[a].$template = !0);
  }, _sendImportAjaxExcel(n) {
    const t = n.server || e.ext.export_api._apiUrl, a = n.store || 0, s = n.data, i = n.callback;
    s.append("type", "excel-parse"), s.append("data", JSON.stringify({ sheet: n.sheet || 0 })), a && s.append("store", a);
    const o = new XMLHttpRequest();
    o.onreadystatechange = function(l) {
      o.readyState === 4 && o.status === 0 && i && i(null);
    }, o.onload = function() {
      let l = null;
      if (!(o.status > 400)) try {
        l = JSON.parse(o.responseText);
      } catch {
      }
      i && i(l);
    }, o.open("POST", t, !0), o.setRequestHeader("X-Requested-With", "XMLHttpRequest"), o.send(s);
  }, _ajaxToExport(n, t, a) {
    delete n.callback;
    const s = n.server || e.ext.export_api._apiUrl, i = "type=" + t + "&store=1&data=" + encodeURIComponent(JSON.stringify(n));
    e.ext.export_api._xdr(s, i, function(o) {
      const l = o.xmlDoc || o;
      let r = null;
      if (!(l.status > 400)) try {
        r = JSON.parse(l.responseText);
      } catch {
      }
      a(r);
    });
  }, _serializableGanttConfig(n) {
    const t = e.mixin({}, n);
    return t.columns && (t.columns = t.columns.map(function(a) {
      const s = e.mixin({}, a);
      return delete s.editor, s;
    })), delete t.editor_types, t;
  }, _sendToExport(n, t) {
    const a = e.date.date_to_str(e.config.date_format || e.config.xml_date);
    if (n.skin || (n.skin = e.skin), n.config && (n.config = e.copy(e.ext.export_api._serializableGanttConfig(n.config)), e.ext.export_api._markColumns(n, t), n.config.start_date && n.config.end_date && (n.config.start_date instanceof Date && (n.config.start_date = a(n.config.start_date)), n.config.end_date instanceof Date && (n.config.end_date = a(n.config.end_date)))), n.callback) return e.ext.export_api._ajaxToExport(n, t, n.callback);
    const s = e.ext.export_api._createHiddenForm();
    s.firstChild.action = n.server || e.ext.export_api._apiUrl, s.firstChild.childNodes[0].value = JSON.stringify(n), s.firstChild.childNodes[1].value = t, s.firstChild.submit();
  }, _createHiddenForm() {
    if (!e.ext.export_api._hidden_export_form) {
      const n = e.ext.export_api._hidden_export_form = document.createElement("div");
      n.style.display = "none", n.innerHTML = "<form method='POST' target='_blank'><textarea name='data' style='width:0px; height:0px;' readonly='true'></textarea><input type='hidden' name='type' value=''></form>", document.body.appendChild(n);
    }
    return e.ext.export_api._hidden_export_form;
  }, _copyObjectBase(n) {
    const t = { start_date: void 0, end_date: void 0, constraint_date: void 0, deadline: void 0 };
    for (const s in n) s.charAt(0) !== "$" && s !== "baselines" && (t[s] = n[s]);
    const a = e.templates.xml_format || e.templates.format_date;
    return t.start_date = a(t.start_date), t.end_date && (t.end_date = a(t.end_date)), t.constraint_date && (t.constraint_date = a(t.constraint_date)), t.deadline && (t.deadline = a(t.deadline)), t;
  }, _color_box: null, _color_hash: {}, _getStyles(n) {
    if (e.ext.export_api._color_box || (e.ext.export_api._color_box = document.createElement("DIV"), e.ext.export_api._color_box.style.cssText = "position:absolute; display:none;", document.body.appendChild(e.ext.export_api._color_box)), e.ext.export_api._color_hash[n]) return e.ext.export_api._color_hash[n];
    e.ext.export_api._color_box.className = n;
    const t = e.ext.export_api._getColor(e.ext.export_api._color_box, "color"), a = e.ext.export_api._getColor(e.ext.export_api._color_box, "backgroundColor");
    return e.ext.export_api._color_hash[n] = t + ";" + a;
  }, _getMinutesWorktimeSettings(n) {
    const t = [];
    return n.forEach(function(a) {
      t.push(a.startMinute), t.push(a.endMinute);
    }), t;
  }, _getWorktimeSettings() {
    const n = { hours: [0, 24], minutes: null, dates: { 0: !0, 1: !0, 2: !0, 3: !0, 4: !0, 5: !0, 6: !0 } };
    let t;
    if (e.config.work_time) {
      const a = e._working_time_helper;
      if (a && a.get_calendar) t = a.get_calendar();
      else if (a) t = { hours: a.hours, minutes: null, dates: a.dates };
      else if (e.config.worktimes && e.config.worktimes.global) {
        const s = e.config.worktimes.global;
        if (s.parsed) {
          t = { hours: null, minutes: e.ext.export_api._getMinutesWorktimeSettings(s.parsed.hours), dates: {} };
          for (const i in s.parsed.dates) Array.isArray(s.parsed.dates[i]) ? t.dates[i] = e.ext.export_api._getMinutesWorktimeSettings(s.parsed.dates[i]) : t.dates[i] = s.parsed.dates[i];
        } else t = { hours: s.hours, minutes: null, dates: s.dates };
      } else t = n;
    } else t = n;
    return t;
  }, _eachTaskTimed: (n, t) => function(a, s, i) {
    s = s || e.config.root_id, i = i || e;
    const o = e.getChildren(s);
    if (o) for (let l = 0; l < o.length; l++) {
      const r = e._pull[o[l]];
      (!n || r.end_date > n) && (!t || r.start_date < t) && a.call(i, r), e.hasChild(r.id) && e.eachTask(a, r.id, i);
    }
  }, _originalCopyObject: e.json._copyObject, _copyObjectPlainICal(n) {
    const t = e.templates.task_text(n.start_date, n.end_date, n), a = e.ext.export_api._copyObjectBase(n);
    return a.text = t || a.text, a;
  }, _copyObjectPlainExcel(n) {
    const t = e.templates.task_text(n.start_date, n.end_date, n), a = e.json.serializeTask(n);
    return a.text = t || a.text, a;
  }, _getColor(n, t) {
    let a = n.currentStyle ? n.currentStyle[t] : getComputedStyle(n, null)[t];
    n.closest(".gantt_task_progress") && a === "rgba(0, 0, 0, 0.15)" && (a = (n = n.parentNode.parentNode).currentStyle ? n.currentStyle[t] : getComputedStyle(n, null)[t]);
    const s = a.replace(/\s/g, "").match(/^rgba?\((\d+),(\d+),(\d+)/i);
    return (s && s.length === 4 ? ("0" + parseInt(s[1], 10).toString(16)).slice(-2) + ("0" + parseInt(s[2], 10).toString(16)).slice(-2) + ("0" + parseInt(s[3], 10).toString(16)).slice(-2) : a).replace("#", "");
  }, _copyObjectTable(n) {
    const t = e.date.date_to_str("%Y-%m-%dT%H:%i:%s.000Z"), a = e.ext.export_api._copyObjectColumns(n, e.ext.export_api._copyObjectPlainExcel(n));
    return a.start_date && (typeof a.start_date == "string" ? a.original_start_date = e.date.str_to_date(e.config.date_format)(a.start_date) : (a.original_start_date = a.start_date, a.start_date = t(n.start_date))), a.end_date ? typeof a.end_date == "string" ? a.original_end_date = e.date.str_to_date(e.config.date_format)(a.end_date) : (a.original_end_date = a.end_date, a.end_date = t(n.end_date)) : a.original_start_date && (a.original_end_date = e.calculateEndDate({ start_date: a.original_start_date, duration: a.duration, task: a }), a.end_date = t(a.original_end_date)), a;
  }, _generatedScales: null, _generateScales() {
    const n = e.getState(), t = st(e), a = [t.primaryScale(e.config)].concat(t.getSubScales(e.config)), s = t.prepareConfigs(a, e.config.min_column_width, 1e3, e.config.scale_height - 1, n.min_date, n.max_date, e.config.rtl);
    return e.ext.export_api._generatedScales = s, s;
  }, _getDayIndex(n, t) {
    let a = n.trace_indexes;
    if (a[+t]) return a[+t];
    {
      a = n.trace_x;
      const s = e.getState();
      return +t <= s.min_date ? e.config.rtl ? a.length : 0 : +t >= s.max_date ? e.config.rtl ? 0 : a.length : function(i, o) {
        for (var l, r, d, c = 0, u = i.length - 1; c <= u; ) if (r = +i[l = Math.floor((c + u) / 2)], d = +i[l - 1], r < o) c = l + 1;
        else {
          if (!(r > o)) {
            for (; +i[l] == +i[l + 1]; ) l++;
            return l;
          }
          if (!isNaN(d) && d < o) return l - 1;
          u = l - 1;
        }
        return i.length - 1;
      }(a, +t);
    }
  }, _copyObjectColors(n, t) {
    const a = e.ext.export_api._copyObjectTable(n);
    let s, i = a.original_start_date, o = a.original_end_date, l = e.columnIndexByDate;
    if (e.ext.export_api._generatedScales) {
      const _ = e.ext.export_api._generatedScales;
      s = _[_.length - 1], a.$start = e.ext.export_api._getDayIndex(s, i), a.$end = e.ext.export_api._getDayIndex(s, o);
    } else s = e.getScale(), a.$start = l.call(e, i), a.$end = l.call(e, o);
    let r = 0;
    const d = s.width;
    if (d.indexOf(0) > -1) {
      let _ = 0;
      for (; _ < a.$start; _++) d[_] || r++;
      for (a.$start -= r; _ < a.$end; _++) d[_] || r++;
      a.$end -= r;
    }
    a.$level = n.$level, a.$type = n.$rendered_type;
    const c = e.templates;
    a.$text = c.task_text(n.start, n.end_date, n), a.$left = c.leftside_text ? c.leftside_text(n.start, n.end_date, n) : "", a.$right = c.rightside_text ? c.rightside_text(n.start, n.end_date, n) : "";
    const u = e.getTaskNode && e.getTaskNode(n.id);
    if (u && u.firstChild) {
      let _ = u;
      t.visual !== "base-colors" && (_ = u.querySelector(".gantt_task_progress"));
      let h = e.ext.export_api._getColor(_, "backgroundColor");
      h === "363636" && (h = e.ext.export_api._getColor(u, "backgroundColor")), a.$color = h;
    } else if (n.color) a.$color = n.color;
    else {
      const _ = e.templates.task_class(n.start, n.end, n);
      if (_) {
        const h = e.ext.export_api._getStyles(_);
        a.$color = h.split(";")[1];
      }
    }
    return a;
  }, _copyObjectColumns(n, t) {
    for (let a = 0; a < e.config.columns.length; a++) {
      const s = e.config.columns[a].template;
      if (s) {
        let i = s(n);
        i instanceof Date && (i = e.templates.date_grid(i, n)), t["_" + a] = i;
      }
    }
    return t;
  }, _copyObjectAll(n) {
    const t = e.ext.export_api._copyObjectBase(n), a = ["leftside_text", "rightside_text", "task_text", "progress_text", "task_class"];
    for (let s = 0; s < a.length; s++) {
      const i = e.templates[a[s]];
      i && (t["$" + s] = i(n.start_date, n.end_date, n));
    }
    return e.ext.export_api._copyObjectColumns(n, t), t.open = n.$open, t;
  }, _serializeHtml() {
    const n = e.config.smart_scales, t = e.config.smart_rendering;
    (n || t) && (e.config.smart_rendering = !1, e.config.smart_scales = !1, e.render());
    const a = e.$container.parentNode.innerHTML;
    return (n || t) && (e.config.smart_scales = n, e.config.smart_rendering = t, e.render()), a;
  }, _serializeAll() {
    e.json._copyObject = e.ext.export_api._copyObjectAll;
    const n = e.ext.export_api._exportSerialize();
    return e.json._copyObject = e.ext.export_api._originalCopyObject, n;
  }, _serializePlain() {
    const n = e.templates.xml_format, t = e.templates.format_date;
    e.templates.xml_format = e.date.date_to_str("%Y%m%dT%H%i%s", !0), e.templates.format_date = e.date.date_to_str("%Y%m%dT%H%i%s", !0), e.json._copyObject = e.ext.export_api._copyObjectPlainICal;
    const a = e.ext.export_api._exportSerialize();
    return e.templates.xml_format = n, e.templates.format_date = t, e.json._copyObject = e.ext.export_api._originalCopyObject, delete a.links, a;
  }, _getRaw() {
    const n = e.$ui.getView("timeline");
    if (n && e.config.show_chart) {
      let t = n.$config.width;
      e.config.autosize !== "x" && e.config.autosize !== "xy" || (t = Math.max(e.config.autosize_min_width, 0));
      const a = e.getState(), s = n._getScales(), i = e.config.min_column_width, o = e.config.scale_height - 1, l = e.config.rtl;
      return n.$scaleHelper.prepareConfigs(s, i, t, o, a.min_date, a.max_date, l);
    }
    return e.ext.export_api._generateScales();
  }, _serializeTimeline(n) {
    let t;
    e.ext.export_api._generatedScales = null, n.visual && (t = e.ext.export_api._getRaw(n.start, n.end)), n.data && (n.custom_dataset = !0);
    let a = n.data || e.serialize().data;
    if (a.forEach(function(s, i) {
      if (n.visual) if (s.render == "split") {
        const o = [];
        n.custom_dataset ? a.forEach(function(r) {
          if (r.parent == s.id) {
            const d = e.ext.export_api._copyObjectColors(r, n);
            d.$split_subtask = !0, o.push(d);
          }
        }) : e.eachTask(function(r) {
          const d = e.ext.export_api._copyObjectColors(r, n);
          o.push(d);
        }, s.id), s.split_bars = [];
        const l = {};
        for (let r = 0; r < o.length; r++) {
          const d = o[r];
          for (let c = 0; c < o.length; c++) {
            const u = o[c];
            if (d.id == u.id || l[u.id]) continue;
            const _ = +d.original_start_date < +u.original_start_date && +u.original_start_date <= +d.original_end_date, h = +u.original_start_date <= +d.original_start_date && +d.original_end_date <= +u.original_end_date;
            if (_ && (d.original_end_date = u.original_start_date, d.end_date = u.start_date, d.$end = u.$start), h) {
              l[d.id] = !0;
              break;
            }
          }
          l[d.id] || s.split_bars.push(d);
        }
        a[i] = s;
      } else s.$split_subtask || (a[i] = e.ext.export_api._copyObjectColors(s, n));
      else a[i] = e.ext.export_api._copyObjectTable(s);
    }), n.raw && !n.data) {
      const s = e.getDatastore("task").visibleOrder;
      if (a.length !== s.length) {
        const i = [];
        a.forEach(function(o) {
          s.indexOf(o.id) > -1 && i.push(o);
        }), a = i;
      }
    }
    if (n.cellColors) {
      const s = e.templates.timeline_cell_class || e.templates.task_cell_class;
      if (s) {
        let i = t[0].trace_x;
        for (let o = 1; o < t.length; o++) t[o].trace_x.length > i.length && (i = t[o].trace_x);
        for (let o = 0; o < a.length; o++) {
          a[o].styles = [];
          const l = e.getTask(a[o].id);
          for (let r = 0; r < i.length; r++) {
            const d = s(l, i[r]);
            d && a[o].styles.push({ index: r, styles: e.ext.export_api._getStyles(d) });
          }
        }
      }
    }
    return a;
  }, _serializeScales(n) {
    const t = [], a = e.ext.export_api._getRaw();
    let s = 1 / 0, i = 0;
    for (let o = 0; o < a.length; o++) s = Math.min(s, a[o].col_width);
    for (let o = 0; o < a.length; o++) {
      let l = 0, r = 0;
      const d = [];
      t.push(d);
      const c = a[o];
      i = Math.max(i, c.trace_x.length);
      const u = c.format || c.template || e.date.date_to_str(c.date);
      for (let _ = 0; _ < c.trace_x.length; _++) {
        const h = c.trace_x[_];
        r = l + Math.round(c.width[_] / s);
        const g = { text: u(h), start: l, end: r, styles: "" };
        if (n.cellColors) {
          const p = c.css || e.templates.scaleCell_class;
          if (p) {
            const k = p(h);
            k && (g.styles = e.ext.export_api._getStyles(k));
          }
        }
        d.push(g), l = r;
      }
    }
    return { width: i, height: t.length, data: t };
  }, _serializeGrid(n) {
    e.exportMode = !0;
    const t = [], a = e.config.columns;
    let s = 0;
    for (let i = 0; i < a.length; i++) a[i].name !== "add" && a[i].name !== "buttons" && (n && n.raw && a[i].hide || (t[s] = { id: a[i].template ? "_" + i : a[i].name, header: a[i].label || e.locale.labels["column_" + a[i].name], width: a[i].width ? Math.floor(a[i].width / 4) : "", tree: a[i].tree || !1 }, a[i].name === "duration" && (t[s].type = "number"), a[i].name !== "start_date" && a[i].name !== "end_date" || (t[s].type = "date", n && n.rawDates && (t[s].id = a[i].name)), s++));
    return e.exportMode = !1, t;
  }, _exportSerialize() {
    e.exportMode = !0;
    const n = e.templates.xml_format, t = e.templates.format_date;
    e.templates.xml_format = e.templates.format_date = e.date.date_to_str(e.config.date_format || e.config.xml_date);
    const a = e.serialize();
    return e.templates.xml_format = n, e.templates.format_date = t, e.exportMode = !1, a;
  }, _setLevel(n) {
    for (let t = 0; t < n.length; t++) {
      n[t].parent == 0 && (n[t]._lvl = 1);
      for (let a = t + 1; a < n.length; a++) n[t].id == n[a].parent && (n[a]._lvl = n[t]._lvl + 1);
    }
  }, _clearLevel(n) {
    for (let t = 0; t < n.length; t++) delete n[t]._lvl;
  }, _clearRecLinks(n) {
    e.ext.export_api._setLevel(n.data);
    const t = {};
    for (let i = 0; i < n.data.length; i++) t[n.data[i].id] = n.data[i];
    const a = {};
    for (let i = 0; i < n.links.length; i++) {
      const o = n.links[i];
      e.isTaskExists(o.source) && e.isTaskExists(o.target) && t[o.source] && t[o.target] && (a[o.id] = o);
    }
    for (const i in a) e.ext.export_api._makeLinksSameLevel(a[i], t);
    const s = {};
    for (const i in t) e.ext.export_api._clearCircDependencies(t[i], a, t, {}, s, null);
    Object.keys(a) && e.ext.export_api._clearLinksSameLevel(a, t);
    for (let i = 0; i < n.links.length; i++) a[n.links[i].id] || (n.links.splice(i, 1), i--);
    e.ext.export_api._clearLevel(n.data);
  }, _clearCircDependencies(n, t, a, s, i, o) {
    const l = n.$_source;
    if (!l) return;
    s[n.id] && e.ext.export_api._onCircDependencyFind(o, t, s, i), s[n.id] = !0;
    const r = {};
    for (let d = 0; d < l.length; d++) {
      if (i[l[d]]) continue;
      const c = t[l[d]], u = a[c._target];
      r[u.id] && e.ext.export_api._onCircDependencyFind(c, t, s, i), r[u.id] = !0, e.ext.export_api._clearCircDependencies(u, t, a, s, i, c);
    }
    s[n.id] = !1;
  }, _onCircDependencyFind(n, t, a, s) {
    n && (e.callEvent("onExportCircularDependency", [n.id, n]) && delete t[n.id], delete a[n._source], delete a[n._target], s[n.id] = !0);
  }, _makeLinksSameLevel(n, t) {
    let a, s;
    const i = { target: t[n.target], source: t[n.source] };
    if (i.target._lvl != i.source._lvl) {
      i.target._lvl < i.source._lvl ? (a = "source", s = i.target._lvl) : (a = "target", s = i.source._lvl);
      do {
        const r = t[i[a].parent];
        if (!r) break;
        i[a] = r;
      } while (i[a]._lvl < s);
      let o = t[i.source.parent], l = t[i.target.parent];
      for (; o && l && o.id != l.id; ) i.source = o, i.target = l, o = t[i.source.parent], l = t[i.target.parent];
    }
    n._target = i.target.id, n._source = i.source.id, i.target.$_target || (i.target.$_target = []), i.target.$_target.push(n.id), i.source.$_source || (i.source.$_source = []), i.source.$_source.push(n.id);
  }, _clearLinksSameLevel(n, t) {
    for (const a in n) delete n[a]._target, delete n[a]._source;
    for (const a in t) delete t[a].$_source, delete t[a].$_target;
  }, _customProjectProperties(n, t) {
    if (t && t.project) {
      for (const a in t.project) e.config.$custom_data || (e.config.$custom_data = {}), e.config.$custom_data[a] = typeof t.project[a] == "function" ? t.project[a](e.config) : t.project[a];
      delete t.project;
    }
  }, _customTaskProperties(n, t) {
    t && t.tasks && (n.data.forEach(function(a) {
      for (const s in t.tasks) a.$custom_data || (a.$custom_data = {}), a.$custom_data[s] = typeof t.tasks[s] == "function" ? t.tasks[s](a, e.config) : t.tasks[s];
    }), delete t.tasks);
  }, _exportConfig(n, t) {
    const a = t.name || "gantt.xml";
    delete t.name, e.config.custom = t;
    const s = e.ext.export_api._getWorktimeSettings(), i = e.getSubtaskDates();
    if (i.start_date && i.end_date) {
      const r = e.templates.format_date || e.templates.xml_format;
      e.config.start_end = { start_date: r(i.start_date), end_date: r(i.end_date) };
    }
    const o = !!e._getAutoSchedulingConfig().enabled, l = { callback: t.callback || null, config: e.config, data: n, manual: o, name: a, worktime: s };
    for (const r in t) l[r] = t[r];
    return l;
  }, _sendImportAjaxMSP(n) {
    const t = n.server || e.ext.export_api._apiUrl, a = n.store || 0, s = n.data, i = n.callback, o = { durationUnit: n.durationUnit || void 0, projectProperties: n.projectProperties || void 0, taskProperties: n.taskProperties || void 0 };
    s.append("type", n.type || "msproject-parse"), s.append("data", JSON.stringify(o)), a && s.append("store", a);
    const l = new XMLHttpRequest();
    l.onreadystatechange = function(r) {
      l.readyState === 4 && l.status === 0 && i && i(null);
    }, l.onload = function() {
      let r = null;
      if (!(l.status > 400)) try {
        r = JSON.parse(l.responseText);
      } catch {
      }
      i && i(r);
    }, l.open("POST", t, !0), l.setRequestHeader("X-Requested-With", "XMLHttpRequest"), l.send(s);
  } }, e.exportToPDF = e.ext.export_api.exportToPDF, e.exportToPNG = e.ext.export_api.exportToPNG, e.exportToICal = e.ext.export_api.exportToICal, e.exportToExcel = e.ext.export_api.exportToExcel, e.exportToJSON = e.ext.export_api.exportToJSON, e.importFromExcel = e.ext.export_api.importFromExcel, e.importFromMSProject = e.ext.export_api.importFromMSProject, e.exportToMSProject = e.ext.export_api.exportToMSProject, e.importFromPrimaveraP6 = e.ext.export_api.importFromPrimaveraP6, e.exportToPrimaveraP6 = e.ext.export_api.exportToPrimaveraP6, e.ext.export_api;
}
const Fe = { onBeforeUndo: "onAfterUndo", onBeforeRedo: "onAfterRedo" }, He = ["onTaskDragStart", "onAfterTaskUpdate", "onAfterParentExpand", "onAfterTaskDelete", "onBeforeBatchUpdate"];
class St {
  constructor(n, t) {
    this._batchAction = null, this._batchMode = !1, this._ignore = !1, this._ignoreMoveEvents = !1, this._initialTasks = {}, this._initialLinks = {}, this._nestedTasks = {}, this._nestedLinks = {}, this._undo = n, this._gantt = t, this._attachEvents();
  }
  store(n, t, a = !1) {
    return t === this._gantt.config.undo_types.task ? this._storeTask(n, a) : t === this._gantt.config.undo_types.link && this._storeLink(n, a);
  }
  isMoveEventsIgnored() {
    return this._ignoreMoveEvents;
  }
  toggleIgnoreMoveEvents(n) {
    this._ignoreMoveEvents = n || !1;
  }
  startIgnore() {
    this._ignore = !0;
  }
  stopIgnore() {
    this._ignore = !1;
  }
  startBatchAction() {
    this._timeout || (this._timeout = setTimeout(() => {
      this.stopBatchAction(), this._timeout = null;
    }, 10)), this._ignore || this._batchMode || (this._batchMode = !0, this._batchAction = this._undo.action.create());
  }
  stopBatchAction() {
    if (this._ignore) return;
    const n = this._undo;
    this._batchAction && n.logAction(this._batchAction), this._batchMode = !1, this._batchAction = null;
  }
  onTaskAdded(n) {
    this._ignore || this._storeTaskCommand(n, this._undo.command.type.add);
  }
  onTaskUpdated(n) {
    this._ignore || this._storeTaskCommand(n, this._undo.command.type.update);
  }
  onTaskMoved(n) {
    this._ignore || (n.$local_index = this._gantt.getTaskIndex(n.id), this._storeEntityCommand(n, this.getInitialTask(n.id), this._undo.command.type.move, this._undo.command.entity.task));
  }
  onTaskDeleted(n) {
    if (!this._ignore) {
      if (this._storeTaskCommand(n, this._undo.command.type.remove), this._nestedTasks[n.id]) {
        const t = this._nestedTasks[n.id];
        for (let a = 0; a < t.length; a++) this._storeTaskCommand(t[a], this._undo.command.type.remove);
      }
      if (this._nestedLinks[n.id]) {
        const t = this._nestedLinks[n.id];
        for (let a = 0; a < t.length; a++) this._storeLinkCommand(t[a], this._undo.command.type.remove);
      }
    }
  }
  onLinkAdded(n) {
    this._ignore || this._storeLinkCommand(n, this._undo.command.type.add);
  }
  onLinkUpdated(n) {
    this._ignore || this._storeLinkCommand(n, this._undo.command.type.update);
  }
  onLinkDeleted(n) {
    this._ignore || this._storeLinkCommand(n, this._undo.command.type.remove);
  }
  setNestedTasks(n, t) {
    const a = this._gantt;
    let s = null;
    const i = [];
    let o = this._getLinks(a.getTask(n));
    for (let d = 0; d < t.length; d++) s = this.setInitialTask(t[d]), o = o.concat(this._getLinks(s)), i.push(s);
    const l = {};
    for (let d = 0; d < o.length; d++) l[o[d]] = !0;
    const r = [];
    for (const d in l) r.push(this.setInitialLink(d));
    this._nestedTasks[n] = i, this._nestedLinks[n] = r;
  }
  setInitialTask(n, t) {
    const a = this._gantt;
    if (t || !this._initialTasks[n] || !this._batchMode) {
      const s = a.copy(a.getTask(n));
      s.$index = a.getGlobalTaskIndex(n), s.$local_index = a.getTaskIndex(n), this.setInitialTaskObject(n, s);
    }
    return this._initialTasks[n];
  }
  getInitialTask(n) {
    return this._initialTasks[n];
  }
  clearInitialTasks() {
    this._initialTasks = {};
  }
  setInitialTaskObject(n, t) {
    this._initialTasks[n] = t;
  }
  setInitialLink(n, t) {
    return this._initialLinks[n] && this._batchMode || (this._initialLinks[n] = this._gantt.copy(this._gantt.getLink(n))), this._initialLinks[n];
  }
  getInitialLink(n) {
    return this._initialLinks[n];
  }
  clearInitialLinks() {
    this._initialLinks = {};
  }
  _attachEvents() {
    let n = null;
    const t = this._gantt, a = () => {
      n || (n = setTimeout(() => {
        n = null;
      }), this.clearInitialTasks(), t.eachTask((r) => {
        this.setInitialTask(r.id);
      }), this.clearInitialLinks(), t.getLinks().forEach((r) => {
        this.setInitialLink(r.id);
      }));
    }, s = (r) => t.copy(t.getTask(r));
    for (const r in Fe) t.attachEvent(r, () => (this.startIgnore(), !0)), t.attachEvent(Fe[r], () => (this.stopIgnore(), !0));
    for (let r = 0; r < He.length; r++) t.attachEvent(He[r], () => (this.startBatchAction(), !0));
    t.attachEvent("onParse", () => {
      this._undo.clearUndoStack(), this._undo.clearRedoStack(), a();
    }), t.attachEvent("onAfterTaskAdd", (r, d) => {
      this.setInitialTask(r, !0), this.onTaskAdded(d);
    }), t.attachEvent("onAfterTaskUpdate", (r, d) => {
      this.onTaskUpdated(d);
    }), t.attachEvent("onAfterParentExpand", (r, d) => {
      this.onTaskUpdated(d);
    }), t.attachEvent("onAfterTaskDelete", (r, d) => {
      this.onTaskDeleted(d);
    }), t.attachEvent("onAfterLinkAdd", (r, d) => {
      this.setInitialLink(r, !0), this.onLinkAdded(d);
    }), t.attachEvent("onAfterLinkUpdate", (r, d) => {
      this.onLinkUpdated(d);
    }), t.attachEvent("onAfterLinkDelete", (r, d) => {
      this.onLinkDeleted(d);
    }), t.attachEvent("onRowDragEnd", (r, d) => (this.onTaskMoved(s(r)), this.toggleIgnoreMoveEvents(), !0)), t.attachEvent("onBeforeTaskDelete", (r) => {
      this.store(r, t.config.undo_types.task);
      const d = [];
      return a(), t.eachTask((c) => {
        d.push(c.id);
      }, r), this.setNestedTasks(r, d), !0;
    });
    const i = t.getDatastore("task");
    i.attachEvent("onBeforeItemMove", (r, d, c) => (this.isMoveEventsIgnored() || a(), !0)), i.attachEvent("onAfterItemMove", (r, d, c) => (this.isMoveEventsIgnored() || this.onTaskMoved(s(r)), !0)), t.attachEvent("onRowDragStart", (r, d, c) => (this.toggleIgnoreMoveEvents(!0), a(), !0));
    let o = null, l = !1;
    if (t.attachEvent("onBeforeTaskDrag", (r) => {
      if (o = t.getState().drag_id, o === r) {
        const d = t.getTask(r);
        t.isSummaryTask(d) && t.config.drag_project && (l = !0);
      }
      if (t.plugins().multiselect) {
        const d = t.getSelectedTasks();
        d.length > 1 && d.forEach((c) => {
          this.store(c, t.config.undo_types.task, !0);
        });
      }
      return this.store(r, t.config.undo_types.task);
    }), t.attachEvent("onAfterTaskDrag", (r) => {
      (l || t.plugins().multiselect && t.getSelectedTasks().length > 1) && o === r && (l = !1, o = null, this.stopBatchAction()), this.store(r, t.config.undo_types.task, !0);
    }), t.attachEvent("onLightbox", (r) => this.store(r, t.config.undo_types.task)), t.attachEvent("onBeforeTaskAutoSchedule", (r) => (this.store(r.id, t.config.undo_types.task, !0), !0)), t.ext.inlineEditors) {
      let r = null, d = null;
      t.attachEvent("onGanttLayoutReady", () => {
        r && t.ext.inlineEditors.detachEvent(r), d && t.ext.inlineEditors.detachEvent(d), d = t.ext.inlineEditors.attachEvent("onEditStart", (c) => {
          t.$data.tempAssignmentsStore && t._lightbox_id || this.store(c.id, t.config.undo_types.task);
        }), r = t.ext.inlineEditors.attachEvent("onBeforeEditStart", (c) => (this.stopBatchAction(), !0));
      });
    }
  }
  _storeCommand(n) {
    const t = this._undo;
    if (t.updateConfigs(), t.undoEnabled) if (this._batchMode) this._batchAction.commands.push(n);
    else {
      const a = t.action.create([n]);
      t.logAction(a);
    }
  }
  _storeEntityCommand(n, t, a, s) {
    const i = this._undo.command.create(n, t, a, s);
    this._storeCommand(i);
  }
  _storeTaskCommand(n, t) {
    this._gantt.isTaskExists(n.id) && (n.$local_index = this._gantt.getTaskIndex(n.id)), this._storeEntityCommand(n, this.getInitialTask(n.id), t, this._undo.command.entity.task);
  }
  _storeLinkCommand(n, t) {
    this._storeEntityCommand(n, this.getInitialLink(n.id), t, this._undo.command.entity.link);
  }
  _getLinks(n) {
    return n.$source.concat(n.$target);
  }
  _storeTask(n, t = !1) {
    const a = this._gantt;
    return this.setInitialTask(n, t), a.eachTask((s) => {
      this.setInitialTask(s.id);
    }, n), !0;
  }
  _storeLink(n, t = !1) {
    return this.setInitialLink(n, t), !0;
  }
}
class Tt {
  constructor(n) {
    this.maxSteps = 100, this.undoEnabled = !0, this.redoEnabled = !0, this.action = { create: (t) => ({ commands: t ? t.slice() : [] }), invert: (t) => {
      const a = this._gantt.copy(t), s = this.command;
      for (let i = 0; i < t.commands.length; i++) {
        const o = a.commands[i] = s.invert(a.commands[i]);
        o.type !== s.type.update && o.type !== s.type.move || ([o.value, o.oldValue] = [o.oldValue, o.value]);
      }
      return a;
    } }, this.command = { entity: null, type: null, create: (t, a, s, i) => {
      const o = this._gantt;
      return { entity: i, type: s, value: o.copy(t), oldValue: o.copy(a || t) };
    }, invert: (t) => {
      const a = this._gantt.copy(t);
      return a.type = this.command.inverseCommands(t.type), a;
    }, inverseCommands: (t) => {
      const a = this._gantt, s = this.command.type;
      switch (t) {
        case s.update:
          return s.update;
        case s.remove:
          return s.add;
        case s.add:
          return s.remove;
        case s.move:
          return s.move;
        default:
          return a.assert(!1, "Invalid command " + t), null;
      }
    } }, this._undoStack = [], this._redoStack = [], this._gantt = n;
  }
  getUndoStack() {
    return this._undoStack;
  }
  setUndoStack(n) {
    this._undoStack = n;
  }
  getRedoStack() {
    return this._redoStack;
  }
  setRedoStack(n) {
    this._redoStack = n;
  }
  clearUndoStack() {
    this._undoStack = [];
  }
  clearRedoStack() {
    this._redoStack = [];
  }
  updateConfigs() {
    const n = this._gantt;
    this.maxSteps = n.config.undo_steps || 100, this.command.entity = n.config.undo_types, this.command.type = n.config.undo_actions, this.undoEnabled = !!n.config.undo, this.redoEnabled = !!n.config.redo;
  }
  undo() {
    const n = this._gantt;
    if (this.updateConfigs(), !this.undoEnabled) return;
    const t = this._pop(this._undoStack);
    if (t && this._reorderCommands(t), n.callEvent("onBeforeUndo", [t]) !== !1 && t) return this._applyAction(this.action.invert(t)), this._push(this._redoStack, n.copy(t)), void n.callEvent("onAfterUndo", [t]);
    n.callEvent("onAfterUndo", [null]);
  }
  redo() {
    const n = this._gantt;
    if (this.updateConfigs(), !this.redoEnabled) return;
    const t = this._pop(this._redoStack);
    if (t && this._reorderCommands(t), n.callEvent("onBeforeRedo", [t]) !== !1 && t) return this._applyAction(t), this._push(this._undoStack, n.copy(t)), void n.callEvent("onAfterRedo", [t]);
    n.callEvent("onAfterRedo", [null]);
  }
  logAction(n) {
    this._push(this._undoStack, n), this._redoStack = [];
  }
  _push(n, t) {
    const a = this._gantt;
    if (!t.commands.length) return;
    const s = n === this._undoStack ? "onBeforeUndoStack" : "onBeforeRedoStack";
    if (a.callEvent(s, [t]) !== !1 && t.commands.length) {
      for (n.push(t); n.length > this.maxSteps; ) n.shift();
      return t;
    }
  }
  _pop(n) {
    return n.pop();
  }
  _reorderCommands(n) {
    const t = { any: 0, link: 1, task: 2 }, a = { move: 1, any: 0 };
    n.commands.sort(function(s, i) {
      if (s.entity === "task" && i.entity === "task") return s.type !== i.type ? (a[i.type] || 0) - (a[s.type] || 0) : s.type === "move" && s.oldValue && i.oldValue && i.oldValue.parent === s.oldValue.parent ? s.oldValue.$index - i.oldValue.$index : 0;
      {
        const o = t[s.entity] || t.any;
        return (t[i.entity] || t.any) - o;
      }
    });
  }
  _applyAction(n) {
    let t = null;
    const a = this.command.entity, s = this.command.type, i = this._gantt, o = {};
    o[a.task] = { add: "addTask", get: "getTask", update: "updateTask", remove: "deleteTask", move: "moveTask", isExists: "isTaskExists" }, o[a.link] = { add: "addLink", get: "getLink", update: "updateLink", remove: "deleteLink", isExists: "isLinkExists" }, i.batchUpdate(function() {
      for (let l = 0; l < n.commands.length; l++) {
        t = n.commands[l];
        const r = o[t.entity][t.type], d = o[t.entity].get, c = o[t.entity].isExists;
        if (t.type === s.add) i[r](t.oldValue, t.oldValue.parent, t.oldValue.$local_index);
        else if (t.type === s.remove) i[c](t.value.id) && i[r](t.value.id);
        else if (t.type === s.update) {
          const u = i[d](t.value.id);
          for (const _ in t.value) {
            let h = !(_.startsWith("$") || _.startsWith("_"));
            ["$open"].indexOf(_) > -1 && (h = !0), h && (u[_] = t.value[_]);
          }
          i[r](t.value.id);
        } else t.type === s.move && (i[r](t.value.id, t.value.$local_index, t.value.parent), i.callEvent("onRowDragEnd", [t.value.id]));
      }
    });
  }
}
const xt = { auto_scheduling: function(e) {
  const { getDefaultAutoSchedulingConfig: n } = nt(e);
  Ne(e);
  var t = We(e), a = Ue(), s = Ie.Create(e), i = new ft(e, a, s), o = new pt(e, t), l = new mt(e, a, t);
  e.getConnectedGroup = o.getConnectedGroup, e.getConstraintType = s.getConstraintType, e.getConstraintLimitations = function(d) {
    var c = s.processConstraint(d, null);
    return c ? { earliestStart: c.earliestStart || null, earliestEnd: c.earliestEnd || null, latestStart: c.latestStart || null, latestEnd: c.latestEnd || null } : { earliestStart: null, earliestEnd: null, latestStart: null, latestEnd: null };
  }, e.isCircularLink = l.isCircularLink, e.findCycles = l.findCycles, e.config.auto_scheduling = n(), e.config.constraint_types = R;
  var r = !1;
  e.attachEvent("onParse", function() {
    return r = !0, !0;
  }), e.attachEvent("onBeforeGanttRender", function() {
    return r = !1, !0;
  }), e._autoSchedule = function(d, c) {
    if (e.callEvent("onBeforeAutoSchedule", [d]) !== !1) {
      e._autoscheduling_in_progress = !0;
      var u = s.getConstraints(d, e.isTaskExists(d) ? c : null), _ = [], h = a.findLoops(c);
      if (h.length) e.callEvent("onAutoScheduleCircularLink", [h]);
      else {
        (function(p, k) {
          if (!e._getAutoSchedulingConfig().apply_constraints) for (var v = 0; v < k.length; v++) {
            var f = k[v], y = e.getTask(f.target);
            e._getAutoSchedulingConfig().gap_behavior !== "preserve" && f.target != p || (f.preferredStart = new Date(y.start_date));
          }
        })(d, c);
        for (let p = 0; p < c.length; p++) if (c[p].subtaskLink) {
          i._secondIterationRequired = !0, i._secondIteration = !1;
          break;
        }
        var g = i.generatePlan(c, u);
        (function(p) {
          p.length && e.batchUpdate(function() {
            for (var k = 0; k < p.length; k++) e.updateTask(p[k]);
          }, r);
        })(_ = i.applyProjectPlan(g));
      }
      e._autoscheduling_in_progress = !1, e.callEvent("onAfterAutoSchedule", [d, _]);
    }
  }, e.autoSchedule = function(d, c) {
    var u;
    c = c === void 0 || !!c, u = d !== void 0 ? e._getAutoSchedulingConfig().apply_constraints ? o.getConnectedGroupRelations(d) : t.getLinkedTasks(d, c) : t.getLinkedTasks(), e._autoSchedule(d, u);
  }, e.attachEvent("onTaskLoading", function(d) {
    return d.constraint_date && typeof d.constraint_date == "string" && (d.constraint_date = e.date.parseDate(d.constraint_date, "parse_date")), d.constraint_type = e.getConstraintType(d), !0;
  }), e.attachEvent("onTaskCreated", function(d) {
    return d.constraint_type = e.getConstraintType(d), !0;
  }), kt(e, t, l, o);
}, critical_path: function(e) {
  Ne(e);
  var n = function(a) {
    var s = We(a), i = Ue(), o = { _freeSlack: {}, _totalSlack: {}, _slackNeedCalculate: !0, _linkedTasksById: {}, _successorsByTaskId: {}, _projectEnd: null, _calculateSlacks: function() {
      var l = s.getLinkedTasks(), r = i.findLoops(l);
      if (r.length) {
        a.callEvent("onAutoScheduleCircularLink", [r]);
        var d = {};
        r.forEach(function(g) {
          g.linkKeys.forEach(function(p) {
            d[p] = !0;
          });
        });
        for (var c = 0; c < l.length; c++) l[c].hashSum in d && (l.splice(c, 1), c--);
      }
      const u = i.topologicalSort(l).reverse(), _ = {};
      l.forEach((g) => {
        _[g.source] || (_[g.source] = { linked: [] }), _[g.source].linked.push({ target: g.target, link: g });
      });
      const h = { _cache: {}, getDist: function(g, p) {
        const k = `${g.id}_${p.id}`;
        if (this._cache[k]) return this._cache[k];
        {
          const v = a.calculateDuration({ start_date: g.end_date, end_date: p.start_date, task: g });
          return this._cache[k] = v, v;
        }
      } };
      this._projectEnd = a.getSubtaskDates().end_date, this._calculateFreeSlack(l, u, _, h), this._calculateTotalSlack(l, u, _, h);
    }, _isCompletedTask: function(l) {
      return a._getAutoSchedulingConfig().use_progress && l.progress == 1;
    }, _calculateFreeSlack: function(l, r, d, c) {
      const u = this._freeSlack = {}, _ = {};
      a.eachTask(function(g) {
        a.isSummaryTask(g) || (_[g.id] = g);
      });
      const h = {};
      l.forEach((g) => {
        const p = _[g.source];
        if (!p) return;
        h[g.source] = !0;
        let k = c.getDist(p, a.getTask(g.target));
        k -= g.lag || 0, u[g.source] !== void 0 ? u[g.source] = Math.min(k, u[g.source]) : u[g.source] = k;
      });
      for (const g in _) {
        if (h[g]) continue;
        const p = _[g];
        this._isCompletedTask(p) || p.unscheduled ? u[p.id] = 0 : u[p.id] = a.calculateDuration({ start_date: p.end_date, end_date: this._projectEnd, task: p });
      }
      return this._freeSlack;
    }, _disconnectedTaskSlack(l) {
      return this._isCompletedTask(l) ? 0 : Math.max(a.calculateDuration(l.end_date, this._projectEnd), 0);
    }, _calculateTotalSlack: function(l, r, d, c) {
      this._totalSlack = {}, this._slackNeedCalculate = !1;
      for (var u = {}, _ = a.getTaskByTime(), h = 0; h < r.length; h++) {
        const p = a.getTask(r[h]);
        if (this._isCompletedTask(p)) u[p.id] = 0;
        else if (d[p.id] || a.isSummaryTask(p)) {
          const k = d[p.id].linked;
          let v = null;
          for (var g = 0; g < k.length; g++) {
            const f = k[g], y = a.getTask(f.target);
            let m = 0;
            u[y.id] !== void 0 && (m += u[y.id]), m += Math.max(c.getDist(p, y) - f.link.targetLag, 0), m -= f.link.trueLag || 0, v = v === null ? m : Math.min(v, m);
          }
          u[p.id] = v || 0;
        } else u[p.id] = this.getFreeSlack(p);
      }
      return _.forEach((function(p) {
        u[p.id] !== void 0 || a.isSummaryTask(p) || (u[p.id] = this.getFreeSlack(p));
      }).bind(this)), this._totalSlack = u, this._totalSlack;
    }, _resetTotalSlackCache: function() {
      this._slackNeedCalculate = !0;
    }, _shouldCalculateTotalSlack: function() {
      return this._slackNeedCalculate;
    }, getFreeSlack: function(l) {
      return this._shouldCalculateTotalSlack() && this._calculateSlacks(), a.isTaskExists(l.id) ? this._isCompletedTask(l) ? 0 : a.isSummaryTask(l) ? void 0 : this._freeSlack[l.id] || 0 : 0;
    }, getTotalSlack: function(l) {
      if (this._shouldCalculateTotalSlack() && this._calculateSlacks(), l === void 0) return this._totalSlack;
      var r;
      if (r = l.id !== void 0 ? l.id : l, this._isCompletedTask(l)) return 0;
      if (this._totalSlack[r] === void 0) {
        if (a.isSummaryTask(a.getTask(r))) {
          var d = null;
          return a.eachTask((function(c) {
            var u = this._totalSlack[c.id];
            u !== void 0 && (d === null || u < d) && (d = u);
          }).bind(this), r), this._totalSlack[r] = d !== null ? d : a.calculateDuration({ start_date: l.end_date, end_date: this._projectEnd, task: l }), this._totalSlack[r];
        }
        return 0;
      }
      return this._totalSlack[r] || 0;
    }, dropCachedFreeSlack: function() {
      this._freeSlack = {}, this._resetTotalSlackCache();
    }, init: function() {
      function l() {
        o.dropCachedFreeSlack();
      }
      a.attachEvent("onAfterLinkAdd", l), a.attachEvent("onTaskIdChange", l), a.attachEvent("onAfterLinkUpdate", l), a.attachEvent("onAfterLinkDelete", l), a.attachEvent("onAfterTaskAdd", l), a.attachEvent("onAfterTaskUpdate", l), a.attachEvent("onAfterTaskDelete", l), a.attachEvent("onRowDragEnd", l), a.attachEvent("onAfterTaskMove", l), a.attachEvent("onParse", l), a.attachEvent("onClear", l), a.$data.tasksStore.attachEvent("onClearAll", l), a.$data.linksStore.attachEvent("onClearAll", l);
    } };
    return o;
  }(e);
  n.init(), e.getFreeSlack = function(a) {
    return n.getFreeSlack(a);
  }, e.getTotalSlack = function(a) {
    return n.getTotalSlack(a);
  };
  var t = function(a) {
    return a._isProjectEnd = function(s) {
      return !this._hasDuration({ start_date: s.end_date, end_date: this._getProjectEnd(), task: s });
    }, { _cache: {}, _slackHelper: null, reset: function() {
      this._cache = {};
    }, _calculateCriticalPath: function() {
      this.reset();
    }, isCriticalTask: function(s) {
      if (!s) return !1;
      if (a._getAutoSchedulingConfig().use_progress && s.progress === 1) return this._cache[s.id] = !1, !1;
      if (s.unscheduled) return !1;
      if (this._cache[s.id] === void 0) if (a.isSummaryTask(s)) {
        let i = !1;
        a.eachTask((function(o) {
          i || (i = this.isCriticalTask(o));
        }).bind(this), s.id), this._cache[s.id] = i;
      } else this._cache[s.id] = this._slackHelper.getTotalSlack(s) <= 0;
      return this._cache[s.id];
    }, init: function(s) {
      this._slackHelper = s;
      var i = a.bind(function() {
        return this.reset(), !0;
      }, this), o = a.bind(function(r, d) {
        return this._cache && (this._cache[d] = this._cache[r], delete this._cache[r]), !0;
      }, this);
      a.attachEvent("onAfterLinkAdd", i), a.attachEvent("onAfterLinkUpdate", i), a.attachEvent("onAfterLinkDelete", i), a.attachEvent("onAfterTaskAdd", i), a.attachEvent("onTaskIdChange", o), a.attachEvent("onAfterTaskUpdate", i), a.attachEvent("onAfterTaskDelete", i), a.attachEvent("onParse", i), a.attachEvent("onClear", i), a.$data.tasksStore.attachEvent("onClearAll", i), a.$data.linksStore.attachEvent("onClearAll", i);
      var l = function() {
        a.config.highlight_critical_path && !a.getState("batchUpdate").batch_update && a.render();
      };
      a.attachEvent("onAfterLinkAdd", l), a.attachEvent("onAfterLinkUpdate", l), a.attachEvent("onAfterLinkDelete", l), a.attachEvent("onAfterTaskAdd", l), a.attachEvent("onTaskIdChange", function(r, d) {
        return a.config.highlight_critical_path && a.isTaskExists(d) && a.refreshTask(d), !0;
      }), a.attachEvent("onAfterTaskUpdate", l), a.attachEvent("onAfterTaskDelete", l);
    } };
  }(e);
  e.config.highlight_critical_path = !1, t.init(n), e.isCriticalTask = function(a) {
    return e.assert(!(!a || a.id === void 0), "Invalid argument for gantt.isCriticalTask"), t.isCriticalTask(a);
  }, e.isCriticalLink = function(a) {
    return this.isCriticalTask(e.getTask(a.source));
  }, e.getSlack = function(a, s) {
    for (var i = 0, o = [], l = {}, r = 0; r < a.$source.length; r++) l[a.$source[r]] = !0;
    for (r = 0; r < s.$target.length; r++) l[s.$target[r]] && o.push(s.$target[r]);
    if (o[0]) for (r = 0; r < o.length; r++) {
      var d = this.getLink(o[r]), c = this._getSlack(a, s, this._convertToFinishToStartLink(d.id, d, a, s, a.parent, s.parent));
      (i > c || r === 0) && (i = c);
    }
    else i = this._getSlack(a, s, {});
    return i;
  }, e._getSlack = function(a, s, i) {
    var o = this.config.types, l = null;
    l = this.getTaskType(a.type) == o.milestone ? a.start_date : a.end_date;
    var r = s.start_date, d = 0;
    d = +l > +r ? -this.calculateDuration({ start_date: r, end_date: l, task: a }) : this.calculateDuration({ start_date: l, end_date: r, task: a });
    var c = i.lag;
    return c && 1 * c == c && (d -= c), d;
  };
}, export_api: function(e) {
  e.ext.export_api = bt(e);
  const n = { _getTransport(t) {
    const a = t.split("://")[0];
    let s, i;
    switch (a) {
      case "https":
        s = require("https"), i = 443;
        break;
      case "http":
        s = require("http"), i = 80;
        break;
      default:
        throw new Error(`Unsupported protocol: ${a}, url: ${t}`);
    }
    return { module: s, defaultPort: i };
  }, _pdfExportRouter(t, a) {
    e.ext.export_api._prepareConfigPDF(t, a), t.version = e.version, e.ext.export_api._sendToExport(t, a);
  }, exportToExcel(t) {
    t = t || {}, (t = e.mixin(t, { name: "gantt.xlsx", title: "Tasks", data: e.ext.export_api._serializeTimeline(t), columns: e.ext.export_api._serializeGrid({ raw: t.raw, rawDates: !0 }), version: e.version }, !0)).visual && (t.scales = e.ext.export_api._serializeScales(t)), e.ext.export_api._sendToExport(t, "excel");
  }, _getRaw: () => e.ext.export_api._generateScales(), importFromExcel(t) {
    e.ext.export_api._processFormData(t, "excel");
  }, importFromMSProject(t) {
    e.ext.export_api._processFormData(t);
  }, _processFormData(t, a) {
    const s = require("form-data"), i = t.server || e.ext.export_api._apiUrl, o = e.ext.export_api._getTransport(i), { hostname: l, port: r, path: d } = e.ext.export_api._parseURL(i, o), c = { hostname: l, port: r, path: d, method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" } }, u = new s();
    if (a === "excel") u.append("file", t.data), u.append("type", "excel-parse"), u.append("data", JSON.stringify({ sheet: t.sheet || 0 }));
    else {
      const h = { durationUnit: t.durationUnit || void 0, projectProperties: t.projectProperties || void 0, taskProperties: t.taskProperties || void 0 };
      u.append("file", t.data), u.append("type", t.type || "msproject-parse"), u.append("data", JSON.stringify(h), c);
    }
    c.headers["Content-Type"] = u.getHeaders()["content-type"];
    const _ = o.module.request(c, function(h) {
      let g = "";
      h.on("data", function(p) {
        g += p;
      }), h.on("end", function(p) {
        t.callback(g.toString());
      });
    });
    _.on("error", function(h) {
      console.error(h);
    }), u.pipe(_);
  }, _sendPostRequest(t, a, s) {
    const i = e.ext.export_api._getTransport(t), { hostname: o, port: l, path: r } = e.ext.export_api._parseURL(t, i), d = { hostname: o, port: l, path: r, method: "POST", headers: { "Content-Type": "application/json", "Content-Length": JSON.stringify(a).length } }, c = i.module.request(d, function(u) {
      const _ = [];
      u.on("data", function(h) {
        _.push(h);
      }), u.on("end", function(h) {
        s(Buffer.concat(_));
      });
    });
    c.on("error", function(u) {
      console.error(u);
    }), c.write(JSON.stringify(a)), c.end();
  }, _parseURL(t, a) {
    const s = t.split("://")[1], i = s.split("/")[0].split(":"), o = s.split("/");
    return { hostname: i[0], port: i[1] || a.defaultPort, path: "/" + o.slice(1).join("/") };
  }, _sendToExport(t, a) {
    const s = e.date.date_to_str(e.config.date_format || e.config.xml_date);
    t.config && (t.config = e.copy(e.ext.export_api._serializableGanttConfig(t.config)), e.ext.export_api._markColumns(t, a), t.config.start_date && t.config.end_date && (t.config.start_date instanceof Date && (t.config.start_date = s(t.config.start_date)), t.config.end_date instanceof Date && (t.config.end_date = s(t.config.end_date))));
    const i = t.server || e.ext.export_api._apiUrl, o = { type: a, store: 0, data: JSON.stringify(t) }, l = t.callback || function(r) {
      console.log(r);
    };
    return e.ext.export_api._sendPostRequest(i, o, l);
  } };
  e.mixin(e.ext.export_api, n, !0), e.exportToExcel = e.ext.export_api.exportToExcel, e.importFromExcel = e.ext.export_api.importFromExcel, e.importFromMSProject = e.ext.export_api.importFromMSProject;
}, grouping: function(e) {
  function n(r, d, c) {
    if (!r || Array.isArray(c) && !c[0]) return 0;
    if (r && !Array.isArray(c)) {
      const _ = [];
      return r.map(function(h) {
        _.push({ resource_id: h, value: 8 });
      }), _;
    }
    if (c[0].resource_id || (c = [{ resource_id: c, value: 8 }]), typeof r == "string" && (r = r.split(",")), r.length == 1) return c[0].resource_id = r[0], [c[0]];
    const u = [];
    r.length > 1 && (r = [...new Set(r)]);
    for (let _ = 0; _ < r.length; _++) {
      let h = r[_], g = c.map(function(p) {
        return p.resource_id;
      }).reduce(function(p, k, v) {
        return k === h && p.push(v), p;
      }, []);
      if (g.length > 0) g.forEach((p) => {
        c[p].resource_id = h, u.push(c[p]);
      });
      else {
        let p = e.copy(c[0]);
        p.resource_id = h, u.push(p);
      }
    }
    return u;
  }
  function t(r, d, c) {
    return r;
  }
  function a(r, d) {
    for (var c = !1, u = !1, _ = 0; _ < r.length; _++) {
      var h = r[_][d];
      if (Array.isArray(h) && (u = !0, h.length && h[0].resource_id !== void 0)) {
        c = !0;
        break;
      }
    }
    return { haveArrays: u, haveResourceAssignments: c };
  }
  function s(r) {
    return r.map(i).sort().join(",");
  }
  function i(r) {
    return String(r && typeof r == "object" ? r.resource_id : r);
  }
  function o(r, d) {
    return r[d] instanceof Array ? r[d].length ? s(r[d]) : 0 : r[d];
  }
  function l() {
    const r = this;
    this.$data.tasksStore._listenerToDrop && this.$data.tasksStore.detachEvent(this.$data.tasksStore._listenerToDrop);
    const d = (c = function() {
      if (!r._groups.dynamicGroups) return !0;
      if (r._groups.regroup) {
        const g = e.getScrollState();
        r._groups.regroup(), g && e.scrollTo(g.x, g.y);
      }
      return !0;
    }, h = function() {
      h.$cancelTimeout(), h.$pending = !0;
      var g = Array.prototype.slice.call(arguments);
      _ = setTimeout(function() {
        c.apply(this, g), h.$pending = !1;
      }, u);
    }, h.$pending = !1, h.$cancelTimeout = function() {
      clearTimeout(_), h.$pending = !1;
    }, h.$execute = function() {
      var g = Array.prototype.slice.call(arguments);
      c.apply(this, g), h.$cancelTimeout();
    }, h);
    var c, u, _, h;
    this.$data.tasksStore.attachEvent("onAfterUpdate", function() {
      return d.$pending || d(), !0;
    }), this.$data.tasksStore.attachEvent("onParse", function() {
      if (!r._groups.dynamicGroups && r._groups.is_active() && a(e.getTaskByTime(), r._groups.relation_property).haveArrays && (r._groups.dynamicGroups = !0, r._groups.regroup && e.getScrollState)) {
        const g = e.getScrollState();
        r._groups.regroup(), g && e.scrollTo(g.x, g.y);
      }
    });
  }
  e._groups = { relation_property: null, relation_id_property: "$group_id", group_id: null, group_text: null, loading: !1, loaded: 0, dynamicGroups: !1, set_relation_value: void 0, _searchCache: null, init: function(r) {
    var d = this;
    r.attachEvent("onClear", function() {
      d.clear();
    }), d.clear();
    var c = r.$data.tasksStore.getParent;
    this._searchCache = null, r.attachEvent("onBeforeTaskMove", function(_, h, g) {
      var p = h === this.config.root_id, k = this._groups.dynamicGroups && !(this._groups.set_relation_value instanceof Function);
      if (d.is_active() && (p || k)) return !1;
      var v = r.getTask(_);
      if (this._groups.save_tree_structure && r.isTaskExists(v.parent) && r.isTaskExists(h)) {
        var f = r.getTask(v.parent), y = r.getTask(h);
        y.$virtual && r.isChildOf(f.id, y.id) && (v.parent = r.config.root_id);
        let m = !1, S = y;
        for (; S; ) _ == S.parent && (m = !0), S = r.isTaskExists(S.parent) ? r.getTask(S.parent) : null;
        if (m) return !1;
      }
      return !0;
    }), r.attachEvent("onRowDragStart", function(_, h) {
      var g = r.getTask(_);
      return this._groups.save_tree_structure && r.isTaskExists(g.parent) && r.config.order_branch && r.config.order_branch != "marker" && (g.$initial_parent = g.parent), !0;
    }), r.attachEvent("onRowDragEnd", function(_, h) {
      if (r.config.order_branch && r.config.order_branch != "marker") {
        var g = r.getTask(_);
        if (g.$initial_parent) {
          if (g.parent == r.config.root_id) {
            var p = r.getTask(g.$rendered_parent), k = r.getTask(g.$initial_parent), v = !1;
            this._groups.dynamicGroups && p[this._groups.group_id] != k[this._groups.group_id] && (v = !0), this._groups.dynamicGroups || p[this._groups.group_id] == k[this._groups.relation_property] || (v = !0), v && (g.parent = g.$initial_parent);
          }
          delete g.$initial_parent;
        }
      }
    }), r.$data.tasksStore._listenerToDrop = r.$data.tasksStore.attachEvent("onStoreUpdated", r.bind(l, r)), r.$data.tasksStore.getParent = function(_) {
      return d.is_active() ? d.get_parent(r, _) : c.apply(this, arguments);
    };
    var u = r.$data.tasksStore.setParent;
    r.$data.tasksStore.setParent = function(_, h) {
      if (!d.is_active()) return u.apply(this, arguments);
      if (d.set_relation_value instanceof Function && r.isTaskExists(h)) {
        var g = (v = r.getTask(h))[d.relation_id_property];
        if (!v.$virtual) {
          var p = o(v, d.relation_property);
          d._searchCache || d._buildCache();
          var k = d._searchCache[p];
          g = r.getTask(k)[d.relation_id_property];
        }
        _[d.group_id] === void 0 && (_[d.group_id] = g), d.save_tree_structure && _[d.group_id] != g && (_[d.group_id] = g), g && (g = typeof g == "string" ? g.split(",") : [g]), _[d.relation_property] = d.set_relation_value(g, _.id, _[d.relation_property]) || g;
      } else if (r.isTaskExists(h)) {
        var v = r.getTask(h);
        d.dynamicGroups || (v.$virtual ? _[d.relation_property] = v[d.relation_id_property] : _[d.relation_property] = v[d.relation_property]), this._setParentInner.apply(this, arguments);
      } else d.dynamicGroups && (_[d.group_id] === void 0 || !_.$virtual && _[d.relation_property][0] === [][0]) && (_[d.relation_property] !== d.group_id ? _[d.relation_property] = _[d.relation_property] || 0 : _[d.relation_property] = 0);
      return r.isTaskExists(h) && (_.$rendered_parent = h, !r.getTask(h).$virtual) ? u.apply(this, arguments) || h : void 0;
    }, r.attachEvent("onBeforeTaskDisplay", function(_, h) {
      return !(d.is_active() && h.type == r.config.types.project && !h.$virtual);
    }), r.attachEvent("onBeforeParse", function() {
      d.loading = !0, d._clearCache();
    }), r.attachEvent("onTaskLoading", function() {
      return d.is_active() && (d.loaded--, d.loaded <= 0 && (d.loading = !1, d._clearCache(), r.eachTask(r.bind(function(_) {
        this.get_parent(r, _);
      }, d)))), !0;
    }), r.attachEvent("onParse", function() {
      d.loading = !1, d.loaded = 0;
    });
  }, _clearCache: function() {
    this._searchCache = null;
  }, _buildCache: function() {
    this._searchCache = {};
    for (var r = e.$data.tasksStore.getItems(), d = 0; d < r.length; d++) this._searchCache[r[d][this.relation_id_property]] = r[d].id;
  }, get_parent: function(r, d, c) {
    d.id === void 0 && (d = r.getTask(d));
    var u = o(d, this.relation_property);
    if (this.save_tree_structure && r.isTaskExists(d.parent)) {
      let g = r.getTask(d.parent);
      const p = o(g, this.relation_property);
      if (g.type != "project" && u == p) return d.parent;
    }
    if (this._groups_pull[u] === d.id) return r.config.root_id;
    if (this._groups_pull[u] !== void 0) return this._groups_pull[u];
    var _ = r.config.root_id;
    if (!this.loading && u !== void 0) {
      this._searchCache || this._buildCache();
      var h = this._searchCache[u];
      r.isTaskExists(h) && h != d.id && (_ = this._searchCache[u]), this._groups_pull[u] = _;
    }
    return _;
  }, clear: function() {
    this._groups_pull = {}, this.relation_property = null, this.group_id = null, this.group_text = null, this._clearCache();
  }, is_active: function() {
    return !!this.relation_property;
  }, generate_sections: function(r, d) {
    for (var c = [], u = 0; u < r.length; u++) {
      var _ = e.copy(r[u]);
      _.type = d, _.open === void 0 && (_.open = !0), _.$virtual = !0, _.readonly = !0, _[this.relation_id_property] = _[this.group_id], _.text = _[this.group_text], c.push(_);
    }
    return c;
  }, clear_temp_tasks: function(r) {
    for (var d = 0; d < r.length; d++) r[d].$virtual && (r.splice(d, 1), d--);
  }, generate_data: function(r, d) {
    var c = r.getLinks(), u = r.getTaskByTime();
    this.clear_temp_tasks(u), u.forEach(function(g) {
      g.$calculate_duration = !1;
    });
    var _ = [];
    this.is_active() && d && d.length && (_ = this.generate_sections(d, r.config.types.project));
    var h = { links: c };
    return h.data = _.concat(u), h;
  }, update_settings: function(r, d, c) {
    this.clear(), this.relation_property = r, this.group_id = d, this.group_text = c;
  }, group_tasks: function(r, d, c, u, _) {
    this.update_settings(c, u, _);
    var h = this.generate_data(r, d);
    this.loaded = h.data.length;
    var g = [];
    r.eachTask(function(v) {
      r.isSelectedTask(v.id) && g.push(v.id);
    }), r._clear_data();
    const p = r._getAutoSchedulingConfig().schedule_on_parse, k = r.config.auto_scheduling_initial;
    k ? r.config.auto_scheduling_initial = !1 : p && (r.config.auto_scheduling.schedule_on_parse = !1), r.parse(h), g.forEach(function(v) {
      r.isTaskExists(v) && r.selectTask(v);
    }), k ? r.config.auto_scheduling_initial = p : p && (r.config.auto_scheduling.schedule_on_parse = p);
  } }, e._groups.init(e), e.groupBy = function(r) {
    var d = this, c = e.getTaskByTime();
    this._groups.set_relation_value = r.set_relation_value, this._groups.dynamicGroups = !1, this._groups.save_tree_structure = r.save_tree_structure;
    var u = a(c, r.relation_property);
    u.haveArrays && (this._groups.dynamicGroups = !0), this._groups.set_relation_value || (this._groups.set_relation_value = function(p) {
      return p.haveResourceAssignments ? n : p.haveArrays ? t : null;
    }(u)), (r = r || {}).default_group_label = r.default_group_label || this.locale.labels.default_group || "None";
    var _ = r.relation_property || null, h = r.group_id || "key", g = r.group_text || "label";
    this._groups.regroup = function() {
      var p = e.getTaskByTime(), k = {}, v = !1;
      p.forEach(function(y) {
        y.$virtual && y.$open !== void 0 && (k[y[h]] = y.$open, v = !0);
      });
      var f = function(y, m, S) {
        var C;
        return C = y.groups ? S._groups.dynamicGroups ? function(b, T) {
          var x = {}, w = [], E = {}, $ = T.relation_property, A = T.delimiter || ",", D = !1, L = 0;
          Q(T.groups, function(N) {
            N.default && (D = !0, L = N.group_id), E[N.key || N[T.group_id]] = N;
          });
          for (var M = 0; M < b.length; M++) {
            var I, P, F = b[M][$];
            if (ce(F)) if (F.length > 0) I = s(F), P = F.map(function(N, pe) {
              var te;
              return te = N && typeof N == "object" ? N.resource_id : N, (N = E[te]).label || N.text;
            }).sort(), P = [...new Set(P)].join(A);
            else {
              if (D) continue;
              I = 0, P = T.default_group_label;
            }
            else if (F) P = E[I = F].label || E[I].text;
            else {
              if (D) continue;
              I = 0, P = T.default_group_label;
            }
            I !== void 0 && x[I] === void 0 && (x[I] = { key: I, label: P }, I === L && (x[I].default = !0), x[I][T.group_text] = P, x[I][T.group_id] = I);
          }
          return (w = function(N) {
            var pe = [];
            for (var te in N) N.hasOwnProperty(te) && pe.push(N[te]);
            return pe;
          }(x)).forEach(function(N) {
            N.key == L && (N.default = !0);
          }), w;
        }(m, y) : y.groups : null, C;
      }(r, p, e);
      return f && v && f.forEach(function(y) {
        k[y[h]] !== void 0 && (y.open = k[y[h]]);
      }), d._groups.group_tasks(d, f, _, h, g), !0;
    }, this._groups.regroup();
  }, e.$services.getService("state").registerProvider("groupBy", function() {
    return { group_mode: e._groups.is_active() ? e._groups.relation_property : null };
  });
}, multiselect: function(e) {
  e.config.multiselect = !0, e.config.multiselect_one_level = !1, e._multiselect = { _selected: {}, _one_level: !1, _active: !0, _first_selected_when_shift: null, getDefaultSelected: function() {
    var n = this.getSelected();
    return n.length ? n[n.length - 1] : null;
  }, setFirstSelected: function(n) {
    this._first_selected_when_shift = n;
  }, getFirstSelected: function() {
    return this._first_selected_when_shift;
  }, isActive: function() {
    return this.updateState(), this._active;
  }, updateState: function() {
    this._one_level = e.config.multiselect_one_level;
    var n = this._active;
    this._active = e.config.select_task, this._active != n && this.reset();
  }, reset: function() {
    this._selected = {};
  }, setLastSelected: function(n) {
    e.$data.tasksStore.silent(function() {
      var t = e.$data.tasksStore;
      n ? t.select(n + "") : t.unselect(null);
    });
  }, getLastSelected: function() {
    var n = e.$data.tasksStore.getSelectedId();
    return n && e.isTaskExists(n) ? n : null;
  }, select: function(n, t) {
    return !!(n && e.callEvent("onBeforeTaskMultiSelect", [n, !0, t]) && e.callEvent("onBeforeTaskSelected", [n])) && (this._selected[n] = !0, this.setLastSelected(n), this.afterSelect(n), e.callEvent("onTaskMultiSelect", [n, !0, t]), e.callEvent("onTaskSelected", [n]), !0);
  }, toggle: function(n, t) {
    this._selected[n] ? this.unselect(n, t) : this.select(n, t);
  }, unselect: function(n, t) {
    n && e.callEvent("onBeforeTaskMultiSelect", [n, !1, t]) && (this._selected[n] = !1, this.getLastSelected() == n && this.setLastSelected(this.getDefaultSelected()), this.afterSelect(n), e.callEvent("onTaskMultiSelect", [n, !1, t]), e.callEvent("onTaskUnselected", [n]));
  }, isSelected: function(n) {
    return !(!e.isTaskExists(n) || !this._selected[n]);
  }, getSelected: function() {
    var n = [];
    for (var t in this._selected) this._selected[t] && e.isTaskExists(t) ? n.push(t) : this._selected[t] = !1;
    return n.sort(function(a, s) {
      return e.getGlobalTaskIndex(a) > e.getGlobalTaskIndex(s) ? 1 : -1;
    }), n;
  }, forSelected: function(n) {
    for (var t = this.getSelected(), a = 0; a < t.length; a++) n(t[a]);
  }, isSameLevel: function(n) {
    if (!this._one_level) return !0;
    var t = this.getLastSelected();
    return !t || !e.isTaskExists(t) || !e.isTaskExists(n) || e.calculateTaskLevel(e.getTask(t)) == e.calculateTaskLevel(e.getTask(n));
  }, afterSelect: function(n) {
    e.isTaskExists(n) && e._quickRefresh(function() {
      e.refreshTask(n);
    });
  }, doSelection: function(n) {
    if (!this.isActive() || e._is_icon_open_click(n)) return !1;
    var t = e.locate(n);
    if (!t || !e.callEvent("onBeforeMultiSelect", [n])) return !1;
    var a = this.getSelected(), s = this.getFirstSelected(), i = !1, o = this.getLastSelected(), l = e.config.multiselect, r = (function() {
      const c = e.ext.inlineEditors;
      if (c && c.getState) {
        const _ = c.getState(), h = c.locateCell(n.target);
        e.config.inline_editors_multiselect_open && h && c.getEditorConfig(h.columnName) && (c.isVisible() && _.id == h.id && _.columnName == h.columnName || c.startEdit(h.id, h.columnName));
      }
      this.setFirstSelected(t), this.isSelected(t) || this.select(t, n), a = this.getSelected();
      for (var u = 0; u < a.length; u++) a[u] !== t && this.unselect(a[u], n);
    }).bind(this), d = (function() {
      if (o) {
        if (t) {
          var c = e.getGlobalTaskIndex(this.getFirstSelected()), u = e.getGlobalTaskIndex(t), _ = e.getGlobalTaskIndex(o);
          c != -1 && _ != -1 || (c = u, this.reset());
          for (var h = o; e.getGlobalTaskIndex(h) !== c; ) this.unselect(h, n), h = c > _ ? e.getNext(h) : e.getPrev(h);
          for (h = t; e.getGlobalTaskIndex(h) !== c; ) this.select(h, n) && !i && (i = !0, s = h), h = c > u ? e.getNext(h) : e.getPrev(h);
        }
      } else o = t;
    }).bind(this);
    return l && (n.ctrlKey || n.metaKey) ? (this.isSelected(t) || this.setFirstSelected(t), t && this.toggle(t, n)) : l && n.shiftKey ? (e.isTaskExists(this.getFirstSelected()) && this.getFirstSelected() !== null || this.setFirstSelected(t), a.length ? d() : r()) : r(), this.isSelected(t) ? this.setLastSelected(t) : s ? t == o && this.setLastSelected(n.shiftKey ? s : this.getDefaultSelected()) : this.setLastSelected(null), this.getSelected().length || this.setLastSelected(null), this.getLastSelected() && this.isSelected(this.getFirstSelected()) || this.setFirstSelected(this.getLastSelected()), !0;
  } }, function() {
    var n = e.selectTask;
    e.selectTask = function(a) {
      if (!(a = K(a, this.config.root_id))) return !1;
      var s = e._multiselect, i = a;
      return s.isActive() ? (s.select(a, null) && s.setLastSelected(a), s.setFirstSelected(s.getLastSelected())) : i = n.call(this, a), i;
    };
    var t = e.unselectTask;
    e.unselectTask = function(a) {
      var s = e._multiselect, i = s.isActive();
      (a = a || s.getLastSelected()) && i && (s.unselect(a, null), a == s.getLastSelected() && s.setLastSelected(null), e.refreshTask(a), s.setFirstSelected(s.getLastSelected()));
      var o = a;
      return i || (o = t.call(this, a)), o;
    }, e.toggleTaskSelection = function(a) {
      var s = e._multiselect;
      a && s.isActive() && (s.toggle(a), s.setFirstSelected(s.getLastSelected()));
    }, e.getSelectedTasks = function() {
      var a = e._multiselect;
      return a.isActive(), a.getSelected();
    }, e.eachSelectedTask = function(a) {
      return this._multiselect.forSelected(a);
    }, e.isSelectedTask = function(a) {
      return this._multiselect.isSelected(a);
    }, e.getLastSelectedTask = function() {
      return this._multiselect.getLastSelected();
    }, e.attachEvent("onGanttReady", function() {
      var a = e.$data.tasksStore.isSelected;
      e.$data.tasksStore.isSelected = function(s) {
        return e._multiselect.isActive() ? e._multiselect.isSelected(s) : a.call(this, s);
      };
    });
  }(), e.attachEvent("onTaskIdChange", function(n, t) {
    var a = e._multiselect;
    if (!a.isActive()) return !0;
    e.isSelectedTask(n) && (a.unselect(n, null), a.select(t, null));
  }), e.attachEvent("onAfterTaskDelete", function(n, t) {
    var a = e._multiselect;
    if (!a.isActive()) return !0;
    a._selected[n] && (a._selected[n] = !1, a.setLastSelected(a.getDefaultSelected())), a.forSelected(function(s) {
      e.isTaskExists(s) || a.unselect(s, null);
    });
  }), e.attachEvent("onBeforeTaskMultiSelect", function(n, t, a) {
    const s = e._multiselect;
    if (t && s.isActive()) {
      let i = e.getSelectedId(), o = null;
      i && (o = e.getTask(i));
      let l = e.getTask(n), r = !1;
      if (o && o.$level != l.$level && (r = !0), e.config.multiselect_one_level && r && !a.ctrlKey && !a.shiftKey) return !0;
      if (s._one_level) return s.isSameLevel(n);
    }
    return !0;
  }), e.attachEvent("onTaskClick", function(n, t) {
    return e._multiselect.doSelection(t) && e.callEvent("onMultiSelect", [t]), !0;
  });
}, undo: function(e) {
  const n = new Tt(e), t = new St(n, e);
  function a(c, u) {
    return String(c) === String(u);
  }
  function s(c, u, _) {
    c && (a(c.id, u) && (c.id = _), a(c.parent, u) && (c.parent = _));
  }
  function i(c, u, _) {
    s(c.value, u, _), s(c.oldValue, u, _);
  }
  function o(c, u, _) {
    c && (a(c.source, u) && (c.source = _), a(c.target, u) && (c.target = _));
  }
  function l(c, u, _) {
    o(c.value, u, _), o(c.oldValue, u, _);
  }
  function r(c, u, _) {
    const h = n;
    for (let g = 0; g < c.length; g++) {
      const p = c[g];
      for (let k = 0; k < p.commands.length; k++) p.commands[k].entity === h.command.entity.task ? i(p.commands[k], u, _) : p.commands[k].entity === h.command.entity.link && l(p.commands[k], u, _);
    }
  }
  function d(c, u, _) {
    const h = n;
    for (let g = 0; g < c.length; g++) {
      const p = c[g];
      for (let k = 0; k < p.commands.length; k++) {
        const v = p.commands[k];
        v.entity === h.command.entity.link && (v.value && v.value.id === u && (v.value.id = _), v.oldValue && v.oldValue.id === u && (v.oldValue.id = _));
      }
    }
  }
  e.config.undo = !0, e.config.redo = !0, e.config.undo_types = { link: "link", task: "task" }, e.config.undo_actions = { update: "update", remove: "remove", add: "add", move: "move" }, e.ext || (e.ext = {}), e.ext.undo = { undo: () => n.undo(), redo: () => n.redo(), getUndoStack: () => n.getUndoStack(), setUndoStack: (c) => n.setUndoStack(c), getRedoStack: () => n.getRedoStack(), setRedoStack: (c) => n.setRedoStack(c), clearUndoStack: () => n.clearUndoStack(), clearRedoStack: () => n.clearRedoStack(), saveState: (c, u) => t.store(c, u, !0), getInitialState: (c, u) => u === e.config.undo_types.link ? t.getInitialLink(c) : t.getInitialTask(c) }, e.undo = e.ext.undo.undo, e.redo = e.ext.undo.redo, e.getUndoStack = e.ext.undo.getUndoStack, e.getRedoStack = e.ext.undo.getRedoStack, e.clearUndoStack = e.ext.undo.clearUndoStack, e.clearRedoStack = e.ext.undo.clearRedoStack, e.attachEvent("onTaskIdChange", (c, u) => {
    const _ = n;
    r(_.getUndoStack(), c, u), r(_.getRedoStack(), c, u);
  }), e.attachEvent("onLinkIdChange", (c, u) => {
    const _ = n;
    d(_.getUndoStack(), c, u), d(_.getRedoStack(), c, u);
  }), e.attachEvent("onGanttReady", () => {
    n.updateConfigs();
  });
} };
class ze {
  constructor(n) {
    this.addExtension = (t, a) => {
      this._extensions[t] = a;
    }, this.getExtension = (t) => this._extensions[t], this._extensions = {};
    for (const t in n) this._extensions[t] = n[t];
  }
}
const U = typeof window < "u" ? window : global, wt = { KEY_CODES: { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, SPACE: 32, ENTER: 13, DELETE: 46, ESC: 27, TAB: 9 } };
var q = typeof window < "u";
const V = typeof navigator < "u" ? navigator : { userAgent: "" }, de = { isIE: q && (V.userAgent.indexOf("MSIE") >= 0 || V.userAgent.indexOf("Trident") >= 0), isOpera: q && (V.userAgent.indexOf("Opera") >= 0 || V.userAgent.indexOf("OPR") >= 0), isChrome: q && V.userAgent.indexOf("Chrome") >= 0, isSafari: q && (V.userAgent.indexOf("Safari") >= 0 || V.userAgent.indexOf("Konqueror") >= 0), isFF: q && V.userAgent.indexOf("Firefox") >= 0, isIPad: q && V.userAgent.search(/iPad/gi) >= 0, isEdge: q && V.userAgent.indexOf("Edge") != -1, isNode: !q || typeof navigator > "u" || !1, isSalesforce: q && (!!U.Sfdc || !!U.$A || U.Aura) };
function Ge(e) {
  if (typeof e == "string" || typeof e == "number") return e;
  let n = "";
  for (const t in e) {
    let a = "";
    e.hasOwnProperty(t) && (a = typeof e[t] == "string" ? encodeURIComponent(e[t]) : typeof e[t] == "number" ? String(e[t]) : encodeURIComponent(JSON.stringify(e[t])), a = t + "=" + a, n.length && (a = "&" + a), n += a);
  }
  return n;
}
function Z(e, n) {
  var t = { method: e };
  if (n.length === 0) throw new Error("Arguments list of query is wrong.");
  if (n.length === 1) return typeof n[0] == "string" ? (t.url = n[0], t.async = !0) : (t.url = n[0].url, t.async = n[0].async || !0, t.callback = n[0].callback, t.headers = n[0].headers), n[0].data ? typeof n[0].data != "string" ? t.data = Ge(n[0].data) : t.data = n[0].data : t.data = "", t;
  switch (t.url = n[0], e) {
    case "GET":
    case "DELETE":
      t.callback = n[1], t.headers = n[2];
      break;
    case "POST":
    case "PUT":
      n[1] ? typeof n[1] != "string" ? t.data = Ge(n[1]) : t.data = n[1] : t.data = "", t.callback = n[2], t.headers = n[3];
  }
  return t;
}
const Je = { date_to_str: (e, n, t) => {
  e = e.replace(/%[a-zA-Z]/g, (s) => {
    switch (s) {
      case "%d":
        return `"+to_fixed(date.get${n ? "UTC" : ""}Date())+"`;
      case "%m":
        return `"+to_fixed((date.get${n ? "UTC" : ""}Month()+1))+"`;
      case "%j":
        return `"+date.get${n ? "UTC" : ""}Date()+"`;
      case "%n":
        return `"+(date.get${n ? "UTC" : ""}Month()+1)+"`;
      case "%y":
        return `"+to_fixed(date.get${n ? "UTC" : ""}FullYear()%100)+"`;
      case "%Y":
        return `"+date.get${n ? "UTC" : ""}FullYear()+"`;
      case "%D":
        return `"+locale.date.day_short[date.get${n ? "UTC" : ""}Day()]+"`;
      case "%l":
        return `"+locale.date.day_full[date.get${n ? "UTC" : ""}Day()]+"`;
      case "%M":
        return `"+locale.date.month_short[date.get${n ? "UTC" : ""}Month()]+"`;
      case "%F":
        return `"+locale.date.month_full[date.get${n ? "UTC" : ""}Month()]+"`;
      case "%h":
        return `"+to_fixed((date.get${n ? "UTC" : ""}Hours()+11)%12+1)+"`;
      case "%g":
        return `"+((date.get${n ? "UTC" : ""}Hours()+11)%12+1)+"`;
      case "%G":
        return `"+date.get${n ? "UTC" : ""}Hours()+"`;
      case "%H":
        return `"+to_fixed(date.get${n ? "UTC" : ""}Hours())+"`;
      case "%i":
        return `"+to_fixed(date.get${n ? "UTC" : ""}Minutes())+"`;
      case "%a":
        return `"+(date.get${n ? "UTC" : ""}Hours()>11?"pm":"am")+"`;
      case "%A":
        return `"+(date.get${n ? "UTC" : ""}Hours()>11?"PM":"AM")+"`;
      case "%s":
        return `"+to_fixed(date.get${n ? "UTC" : ""}Seconds())+"`;
      case "%W":
        return '"+to_fixed(getISOWeek(date))+"';
      case "%w":
        return '"+to_fixed(getWeek(date))+"';
      default:
        return s;
    }
  });
  const a = new Function("date", "to_fixed", "locale", "getISOWeek", "getWeek", `return "${e}";`);
  return (s) => a(s, t.date.to_fixed, t.locale, t.date.getISOWeek, t.date.getWeek);
}, str_to_date: (e, n, t) => {
  let a = "var temp=date.match(/[a-zA-Z]+|[0-9]+/g);";
  const s = e.match(/%[a-zA-Z]/g);
  for (let l = 0; l < s.length; l++) switch (s[l]) {
    case "%j":
    case "%d":
      a += `set[2]=temp[${l}]||1;`;
      break;
    case "%n":
    case "%m":
      a += `set[1]=(temp[${l}]||1)-1;`;
      break;
    case "%y":
      a += `set[0]=temp[${l}]*1+(temp[${l}]>50?1900:2000);`;
      break;
    case "%g":
    case "%G":
    case "%h":
    case "%H":
      a += `set[3]=temp[${l}]||0;`;
      break;
    case "%i":
      a += `set[4]=temp[${l}]||0;`;
      break;
    case "%Y":
      a += `set[0]=temp[${l}]||0;`;
      break;
    case "%a":
    case "%A":
      a += `set[3]=set[3]%12+((temp[${l}]||'').toLowerCase()=='am'?0:12);`;
      break;
    case "%s":
      a += `set[5]=temp[${l}]||0;`;
      break;
    case "%M":
      a += `set[1]=locale.date.month_short_hash[temp[${l}]]||0;`;
      break;
    case "%F":
      a += `set[1]=locale.date.month_full_hash[temp[${l}]]||0;`;
  }
  let i = "set[0],set[1],set[2],set[3],set[4],set[5]";
  n && (i = ` Date.UTC(${i})`);
  const o = new Function("date", "locale", `var set=[0,0,1,0,0,0]; ${a} return new Date(${i});`);
  return (l) => o(l, t.locale);
} }, Ve = { date_to_str: (e, n, t) => (a) => e.replace(/%[a-zA-Z]/g, (s) => {
  switch (s) {
    case "%d":
      return n ? t.date.to_fixed(a.getUTCDate()) : t.date.to_fixed(a.getDate());
    case "%m":
      return n ? t.date.to_fixed(a.getUTCMonth() + 1) : t.date.to_fixed(a.getMonth() + 1);
    case "%j":
      return n ? a.getUTCDate() : a.getDate();
    case "%n":
      return n ? a.getUTCMonth() + 1 : a.getMonth() + 1;
    case "%y":
      return n ? t.date.to_fixed(a.getUTCFullYear() % 100) : t.date.to_fixed(a.getFullYear() % 100);
    case "%Y":
      return n ? a.getUTCFullYear() : a.getFullYear();
    case "%D":
      return n ? t.locale.date.day_short[a.getUTCDay()] : t.locale.date.day_short[a.getDay()];
    case "%l":
      return n ? t.locale.date.day_full[a.getUTCDay()] : t.locale.date.day_full[a.getDay()];
    case "%M":
      return n ? t.locale.date.month_short[a.getUTCMonth()] : t.locale.date.month_short[a.getMonth()];
    case "%F":
      return n ? t.locale.date.month_full[a.getUTCMonth()] : t.locale.date.month_full[a.getMonth()];
    case "%h":
      return n ? t.date.to_fixed((a.getUTCHours() + 11) % 12 + 1) : t.date.to_fixed((a.getHours() + 11) % 12 + 1);
    case "%g":
      return n ? (a.getUTCHours() + 11) % 12 + 1 : (a.getHours() + 11) % 12 + 1;
    case "%G":
      return n ? a.getUTCHours() : a.getHours();
    case "%H":
      return n ? t.date.to_fixed(a.getUTCHours()) : t.date.to_fixed(a.getHours());
    case "%i":
      return n ? t.date.to_fixed(a.getUTCMinutes()) : t.date.to_fixed(a.getMinutes());
    case "%a":
      return n ? a.getUTCHours() > 11 ? "pm" : "am" : a.getHours() > 11 ? "pm" : "am";
    case "%A":
      return n ? a.getUTCHours() > 11 ? "PM" : "AM" : a.getHours() > 11 ? "PM" : "AM";
    case "%s":
      return n ? t.date.to_fixed(a.getUTCSeconds()) : t.date.to_fixed(a.getSeconds());
    case "%W":
      return n ? t.date.to_fixed(t.date.getUTCISOWeek(a)) : t.date.to_fixed(t.date.getISOWeek(a));
    case "%w":
      return t.date.to_fixed(t.date.getWeek(a));
    default:
      return s;
  }
}), str_to_date: (e, n, t) => (a) => {
  const s = [0, 0, 1, 0, 0, 0], i = a.match(/[a-zA-Z]+|[0-9]+/g), o = e.match(/%[a-zA-Z]/g);
  for (let l = 0; l < o.length; l++) switch (o[l]) {
    case "%j":
    case "%d":
      s[2] = i[l] || 1;
      break;
    case "%n":
    case "%m":
      s[1] = (i[l] || 1) - 1;
      break;
    case "%y":
      s[0] = 1 * i[l] + (i[l] > 50 ? 1900 : 2e3);
      break;
    case "%g":
    case "%G":
    case "%h":
    case "%H":
      s[3] = i[l] || 0;
      break;
    case "%i":
      s[4] = i[l] || 0;
      break;
    case "%Y":
      s[0] = i[l] || 0;
      break;
    case "%a":
    case "%A":
      s[3] = s[3] % 12 + ((i[l] || "").toLowerCase() === "am" ? 0 : 12);
      break;
    case "%s":
      s[5] = i[l] || 0;
      break;
    case "%M":
      s[1] = t.locale.date.month_short_hash[i[l]] || 0;
      break;
    case "%F":
      s[1] = t.locale.date.month_full_hash[i[l]] || 0;
  }
  return n ? new Date(Date.UTC(s[0], s[1], s[2], s[3], s[4], s[5])) : new Date(s[0], s[1], s[2], s[3], s[4], s[5]);
} };
function Ct(e) {
  var n = null;
  function t() {
    var s = !1;
    return e.config.csp === "auto" ? (n === null && function() {
      try {
        new Function("canUseCsp = false;");
      } catch {
        n = !0;
      }
    }(), s = n) : s = e.config.csp, s;
  }
  var a = { init: function() {
    for (var s = e.locale, i = s.date.month_short, o = s.date.month_short_hash = {}, l = 0; l < i.length; l++) o[i[l]] = l;
    for (i = s.date.month_full, o = s.date.month_full_hash = {}, l = 0; l < i.length; l++) o[i[l]] = l;
  }, date_part: function(s) {
    var i = new Date(s);
    return s.setHours(0), this.hour_start(s), s.getHours() && (s.getDate() < i.getDate() || s.getMonth() < i.getMonth() || s.getFullYear() < i.getFullYear()) && s.setTime(s.getTime() + 36e5 * (24 - s.getHours())), s;
  }, time_part: function(s) {
    return (s.valueOf() / 1e3 - 60 * s.getTimezoneOffset()) % 86400;
  }, week_start: function(s) {
    var i = s.getDay();
    return e.config.start_on_monday && (i === 0 ? i = 6 : i--), this.date_part(this.add(s, -1 * i, "day"));
  }, month_start: function(s) {
    return s.setDate(1), this.date_part(s);
  }, quarter_start: function(s) {
    this.month_start(s);
    var i, o = s.getMonth();
    return i = o >= 9 ? 9 : o >= 6 ? 6 : o >= 3 ? 3 : 0, s.setMonth(i), s;
  }, year_start: function(s) {
    return s.setMonth(0), this.month_start(s);
  }, day_start: function(s) {
    return this.date_part(s);
  }, hour_start: function(s) {
    return s.getMinutes() && s.setMinutes(0), this.minute_start(s), s;
  }, minute_start: function(s) {
    return s.getSeconds() && s.setSeconds(0), s.getMilliseconds() && s.setMilliseconds(0), s;
  }, _add_days: function(s, i, o) {
    s.setDate(s.getDate() + i);
    var l = i >= 0, r = !o.getHours() && s.getHours(), d = s.getDate() <= o.getDate() || s.getMonth() < o.getMonth() || s.getFullYear() < o.getFullYear();
    return l && r && d && s.setTime(s.getTime() + 36e5 * (24 - s.getHours())), i > 1 && r && s.setHours(0), s;
  }, add: function(s, i, o) {
    var l = new Date(s.valueOf());
    switch (o) {
      case "day":
        l = this._add_days(l, i, s);
        break;
      case "week":
        l = this._add_days(l, 7 * i, s);
        break;
      case "month":
        l.setMonth(l.getMonth() + i);
        break;
      case "year":
        l.setYear(l.getFullYear() + i);
        break;
      case "hour":
        l.setTime(l.getTime() + 60 * i * 60 * 1e3);
        break;
      case "minute":
        l.setTime(l.getTime() + 60 * i * 1e3);
        break;
      default:
        return this["add_" + o](s, i, o);
    }
    return l;
  }, add_quarter: function(s, i) {
    return this.add(s, 3 * i, "month");
  }, to_fixed: function(s) {
    return s < 10 ? "0" + s : s;
  }, copy: function(s) {
    return new Date(s.valueOf());
  }, date_to_str: function(s, i) {
    var o = Je;
    return t() && (o = Ve), o.date_to_str(s, i, e);
  }, str_to_date: function(s, i) {
    var o = Je;
    return t() && (o = Ve), o.str_to_date(s, i, e);
  }, getISOWeek: function(s) {
    return e.date._getWeekNumber(s, !0);
  }, _getWeekNumber: function(s, i) {
    if (!s) return !1;
    var o = s.getDay();
    i && o === 0 && (o = 7);
    var l = new Date(s.valueOf());
    l.setDate(s.getDate() + (4 - o));
    var r = l.getFullYear(), d = Math.round((l.getTime() - new Date(r, 0, 1).getTime()) / 864e5);
    return 1 + Math.floor(d / 7);
  }, getWeek: function(s) {
    return e.date._getWeekNumber(s, e.config.start_on_monday);
  }, getUTCISOWeek: function(s) {
    return e.date.getISOWeek(s);
  }, convert_to_utc: function(s) {
    return new Date(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), s.getUTCHours(), s.getUTCMinutes(), s.getUTCSeconds());
  }, parseDate: function(s, i) {
    return s && !s.getFullYear && (typeof i != "function" && (i = typeof i == "string" ? i === "parse_date" || i === "xml_date" ? e.defined(e.templates.xml_date) ? e.templates.xml_date : e.templates.parse_date : e.defined(e.templates[i]) ? e.templates[i] : e.date.str_to_date(i) : e.defined(e.templates.xml_date) ? e.templates.xml_date : e.templates.parse_date), s = s ? i(s) : null), s;
  } };
  return a;
}
class it {
  constructor(n) {
    const { url: t, token: a } = n;
    this._url = t, this._token = a, this._mode = 1, this._seed = 1, this._queue = [], this.data = {}, this.api = {}, this._events = {};
  }
  headers() {
    return { Accept: "application/json", "Content-Type": "application/json", "Remote-Token": this._token };
  }
  fetch(n, t) {
    const a = { credentials: "include", headers: this.headers() };
    return t && (a.method = "POST", a.body = t), fetch(n, a).then((s) => s.json());
  }
  load(n) {
    return n && (this._url = n), this.fetch(this._url).then((t) => this.parse(t));
  }
  parse(n) {
    const { key: t, websocket: a } = n;
    t && (this._token = n.key);
    for (const s in n.data) this.data[s] = n.data[s];
    for (const s in n.api) {
      const i = this.api[s] = {}, o = n.api[s];
      for (const l in o) i[l] = this._wrapper(s + "." + l);
    }
    return a && this.connect(), this;
  }
  connect() {
    const n = this._socket;
    n && (this._socket = null, n.onclose = function() {
    }, n.close()), this._mode = 2, this._socket = function(t, a, s, i) {
      let o = a;
      o[0] === "/" && (o = document.location.protocol + "//" + document.location.host + a), o = o.replace(/^http(s|):/, "ws$1:");
      const l = o.indexOf("?") != -1 ? "&" : "?";
      o = `${o}${l}token=${s}&ws=1`;
      const r = new WebSocket(o);
      return r.onclose = () => setTimeout(() => t.connect(), 2e3), r.onmessage = (d) => {
        const c = JSON.parse(d.data);
        switch (c.action) {
          case "result":
            t.result(c.body, []);
            break;
          case "event":
            t.fire(c.body.name, c.body.value);
            break;
          case "start":
            i();
            break;
          default:
            t.onError(c.data);
        }
      }, r;
    }(this, this._url, this._token, () => (this._mode = 3, this._send(), this._resubscribe(), this));
  }
  _wrapper(n) {
    return (function() {
      const t = [].slice.call(arguments);
      let a = null;
      const s = new Promise((i, o) => {
        a = { data: { id: this._uid(), name: n, args: t }, status: 1, resolve: i, reject: o }, this._queue.push(a);
      });
      return this.onCall(a, s), this._mode === 3 ? this._send(a) : setTimeout(() => this._send(), 1), s;
    }).bind(this);
  }
  _uid() {
    return (this._seed++).toString();
  }
  _send(n) {
    if (this._mode == 2) return void setTimeout(() => this._send(), 100);
    const t = n ? [n] : this._queue.filter((s) => s.status === 1);
    if (!t.length) return;
    const a = t.map((s) => (s.status = 2, s.data));
    this._mode !== 3 ? this.fetch(this._url, JSON.stringify(a)).catch((s) => this.onError(s)).then((s) => this.result(s, a)) : this._socket.send(JSON.stringify({ action: "call", body: a }));
  }
  result(n, t) {
    const a = {};
    if (n) for (let s = 0; s < n.length; s++) a[n[s].id] = n[s];
    else for (let s = 0; s < t.length; s++) a[t[s].id] = { id: t[s].id, error: "Network Error", data: null };
    for (let s = this._queue.length - 1; s >= 0; s--) {
      const i = this._queue[s], o = a[i.data.id];
      o && (this.onResponse(i, o), o.error ? i.reject(o.error) : i.resolve(o.data), this._queue.splice(s, 1));
    }
  }
  on(n, t) {
    const a = this._uid();
    let s = this._events[n];
    const i = !!s;
    return i || (s = this._events[n] = []), s.push({ id: a, handler: t }), i || this._mode != 3 || this._socket.send(JSON.stringify({ action: "subscribe", name: n })), { name: n, id: a };
  }
  _resubscribe() {
    if (this._mode == 3) for (const n in this._events) this._socket.send(JSON.stringify({ action: "subscribe", name: n }));
  }
  detach(n) {
    if (!n) {
      if (this._mode == 3) for (const i in this._events) this._socket.send(JSON.stringify({ action: "unsubscribe", key: i }));
      return void (this._events = {});
    }
    const { id: t, name: a } = n, s = this._events[a];
    if (s) {
      const i = s.filter((o) => o.id != t);
      i.length ? this._events[a] = i : (delete this._events[a], this._mode == 3 && this._socket.send(JSON.stringify({ action: "unsubscribe", name: a })));
    }
  }
  fire(n, t) {
    const a = this._events[n];
    if (a) for (let s = 0; s < a.length; s++) a[s].handler(t);
  }
  onError(n) {
    return null;
  }
  onCall(n, t) {
  }
  onResponse(n, t) {
  }
}
const Et = function(e, n) {
  const t = new it({ url: e, token: n });
  t.fetch = function(a, s) {
    const i = { headers: this.headers() };
    return s && (i.method = "POST", i.body = s), fetch(a, i).then((o) => o.json());
  }, this._ready = t.load().then((a) => this._remote = a), this.ready = function() {
    return this._ready;
  }, this.on = function(a, s) {
    this.ready().then((i) => {
      if (typeof a == "string") i.on(a, s);
      else for (const o in a) i.on(o, a[o]);
    });
  };
};
var rt = function() {
  this._silent_mode = !1, this.listeners = {};
};
rt.prototype = { _silentStart: function() {
  this._silent_mode = !0;
}, _silentEnd: function() {
  this._silent_mode = !1;
} };
function ie(e) {
  var n = new rt();
  e.attachEvent = function(t, a, s) {
    t = "ev_" + t.toLowerCase(), n.listeners[t] || (n.listeners[t] = function(o) {
      var l = {}, r = 0, d = function() {
        var c = !0;
        for (var u in l) {
          var _ = l[u].apply(o, arguments);
          c = c && _;
        }
        return c;
      };
      return d.addEvent = function(c, u) {
        if (typeof c == "function") {
          var _;
          if (u && u.id ? _ = u.id : (_ = r, r++), u && u.once) {
            var h = c;
            c = function() {
              h(), d.removeEvent(_);
            };
          }
          return l[_] = c, _;
        }
        return !1;
      }, d.removeEvent = function(c) {
        delete l[c];
      }, d.clear = function() {
        l = {};
      }, d;
    }(this)), s && s.thisObject && (a = a.bind(s.thisObject));
    var i = t + ":" + n.listeners[t].addEvent(a, s);
    return s && s.id && (i = s.id), i;
  }, e.attachAll = function(t) {
    this.attachEvent("listen_all", t);
  }, e.callEvent = function(t, a) {
    if (n._silent_mode) return !0;
    var s = "ev_" + t.toLowerCase(), i = n.listeners;
    return i.ev_listen_all && i.ev_listen_all.apply(this, [t].concat(a)), !i[s] || i[s].apply(this, a);
  }, e.checkEvent = function(t) {
    return !!n.listeners["ev_" + t.toLowerCase()];
  }, e.detachEvent = function(t) {
    if (t) {
      var a = n.listeners;
      for (var s in a) a[s].removeEvent(t);
      var i = t.split(":");
      if (a = n.listeners, i.length === 2) {
        var o = i[0], l = i[1];
        a[o] && a[o].removeEvent(l);
      }
    }
  }, e.detachAllEvents = function() {
    for (var t in n.listeners) n.listeners[t].clear();
  };
}
function xe(e) {
  var n = 0, t = 0, a = 0, s = 0;
  if (e.getBoundingClientRect) {
    var i = e.getBoundingClientRect(), o = document.body, l = document.documentElement || document.body.parentNode || document.body, r = window.pageYOffset || l.scrollTop || o.scrollTop, d = window.pageXOffset || l.scrollLeft || o.scrollLeft, c = l.clientTop || o.clientTop || 0, u = l.clientLeft || o.clientLeft || 0;
    n = i.top + r - c, t = i.left + d - u, a = document.body.offsetWidth - i.right, s = document.body.offsetHeight - i.bottom;
  } else {
    for (; e; ) n += parseInt(e.offsetTop, 10), t += parseInt(e.offsetLeft, 10), e = e.offsetParent;
    a = document.body.offsetWidth - e.offsetWidth - t, s = document.body.offsetHeight - e.offsetHeight - n;
  }
  return { y: Math.round(n), x: Math.round(t), width: e.offsetWidth, height: e.offsetHeight, right: Math.round(a), bottom: Math.round(s) };
}
function $t(e) {
  var n = !1, t = !1;
  if (window.getComputedStyle) {
    var a = window.getComputedStyle(e, null);
    n = a.display, t = a.visibility;
  } else e.currentStyle && (n = e.currentStyle.display, t = e.currentStyle.visibility);
  return n != "none" && t != "hidden";
}
function At(e) {
  return !isNaN(e.getAttribute("tabindex")) && 1 * e.getAttribute("tabindex") >= 0;
}
function Dt(e) {
  return !{ a: !0, area: !0 }[e.nodeName.loLowerCase()] || !!e.getAttribute("href");
}
function Mt(e) {
  return !{ input: !0, select: !0, textarea: !0, button: !0, object: !0 }[e.nodeName.toLowerCase()] || !e.hasAttribute("disabled");
}
function Ye(e) {
  for (var n = e.querySelectorAll(["a[href]", "area[href]", "input", "select", "textarea", "button", "iframe", "object", "embed", "[tabindex]", "[contenteditable]"].join(", ")), t = Array.prototype.slice.call(n, 0), a = 0; a < t.length; a++) t[a].$position = a;
  for (t.sort(function(i, o) {
    return i.tabIndex === 0 && o.tabIndex !== 0 ? 1 : i.tabIndex !== 0 && o.tabIndex === 0 ? -1 : i.tabIndex === o.tabIndex ? i.$position - o.$position : i.tabIndex < o.tabIndex ? -1 : 1;
  }), a = 0; a < t.length; a++) {
    var s = t[a];
    (At(s) || Mt(s) || Dt(s)) && $t(s) || (t.splice(a, 1), a--);
  }
  return t;
}
function Lt(e) {
  if (!e) return "";
  var n, t = e.className || "";
  return t.baseVal && (t = t.baseVal), t.indexOf || (t = ""), n = t, (String.prototype.trim || function() {
    return this.replace(/^\s+|\s+$/g, "");
  }).apply(n);
}
function oe(e, n) {
  if (n) {
    for (var t = function(a) {
      var s;
      return a.tagName ? s = a : (s = (a = a || window.event).target || a.srcElement).shadowRoot && a.composedPath && (s = a.composedPath()[0]), s;
    }(e); t; ) {
      if (t.getAttribute && t.getAttribute(n)) return t;
      t = t.parentNode || t.host;
    }
    return null;
  }
}
function It(e, n) {
  var o;
  const t = document.documentElement, a = xe(n), { clientX: s, clientY: i } = ((o = e.touches) == null ? void 0 : o[0]) ?? e;
  return { x: s + t.scrollLeft - t.clientLeft - a.x + n.scrollLeft, y: i + t.scrollTop - t.clientTop - a.y + n.scrollTop };
}
function ot(e, n) {
  if (e.closest) return e.closest(n);
  if (e.matches || e.msMatchesSelector || e.webkitMatchesSelector) {
    var t = e;
    if (!document.documentElement.contains(t)) return null;
    do {
      if ((t.matches || t.msMatchesSelector || t.webkitMatchesSelector).call(t, n)) return t;
      t = t.parentElement || t.parentNode;
    } while (t !== null && t.nodeType === 1);
    return null;
  }
  return console.error("Your browser is not supported"), null;
}
function Ot(e) {
  for (; e; ) {
    if (e.offsetWidth > 0 && e.offsetHeight > 0) return e;
    e = e.parentElement;
  }
  return null;
}
function Ke(e) {
  if (!e || !document.head.createShadowRoot && !document.head.attachShadow) return document.body;
  for (; e.parentNode && (e = e.parentNode); ) if (e instanceof ShadowRoot) return e.host;
  return document.body;
}
function Pt(e) {
  function n(a) {
    return { target: a.target || a.srcElement, pageX: a.pageX, pageY: a.pageY, clientX: a.clientX, clientY: a.clientY, metaKey: a.metaKey, shiftKey: a.shiftKey, ctrlKey: a.ctrlKey, altKey: a.altKey };
  }
  function t(a, s) {
    this._obj = a, this._settings = s || {}, ie(this);
    var i = this.getInputMethods();
    this._drag_start_timer = null, e.attachEvent("onGanttScroll", O(function(r, d) {
      this.clearDragTimer();
    }, this));
    for (var o = { passive: !1 }, l = 0; l < i.length; l++) O(function(r) {
      e.event(a, r.down, O(function(c) {
        r.accessor(c) && (c.button !== void 0 && c.button !== 0 || (s.preventDefault && s.selector && ot(c.target, s.selector) && c.preventDefault(), e.config.touch && c.timeStamp && c.timeStamp - 0 < 300 || (this._settings.original_target = n(c), this._settings.original_element_sizes = { ...It(c, Ot(a)), width: c.target.offsetWidth, height: c.target.offsetHeight }, e.config.touch ? (this.clearDragTimer(), this._drag_start_timer = setTimeout(O(function() {
          e.getState().lightbox || this.dragStart(a, c, r);
        }, this), e.config.touch_drag)) : this.dragStart(a, c, r))));
      }, this), o);
      var d = document.body;
      e.event(d, r.up, O(function(c) {
        r.accessor(c) && this.clearDragTimer();
      }, this), o);
    }, this)(i[l]);
  }
  return t.prototype = { traceDragEvents: function(a, s) {
    var i = O(function(u) {
      return this.dragMove(a, u, s.accessor);
    }, this);
    O(function(u) {
      return this.dragScroll(a, u);
    }, this);
    var o = O(function(u) {
      if (!this.config.started || !j(this.config.updates_per_second) || function(h, g) {
        if (!g) return !0;
        if (h._on_timeout) return !1;
        var p = Math.ceil(1e3 / g);
        return p < 2 || (setTimeout(function() {
          delete h._on_timeout;
        }, p), h._on_timeout = !0), !0;
      }(this, this.config.updates_per_second)) {
        var _ = i(u);
        if (_) try {
          u && u.preventDefault && u.cancelable && u.preventDefault();
        } catch {
        }
        return _;
      }
    }, this), l = Ke(e.$root), r = this.config.mousemoveContainer || Ke(e.$root), d = { passive: !1 }, c = O(function(u) {
      return e.eventRemove(r, s.move, o), e.eventRemove(l, s.up, c, d), this.dragEnd(a);
    }, this);
    e.event(r, s.move, o, d), e.event(l, s.up, c, d);
  }, checkPositionChange: function(a) {
    var s = a.x - this.config.pos.x, i = a.y - this.config.pos.y;
    return Math.sqrt(Math.pow(Math.abs(s), 2) + Math.pow(Math.abs(i), 2)) > this.config.sensitivity;
  }, initDnDMarker: function() {
    var a = this.config.marker = document.createElement("div");
    a.className = "gantt_drag_marker", a.innerHTML = "", document.body.appendChild(a);
  }, backupEventTarget: function(a, s) {
    if (e.config.touch) {
      var i = s(a), o = i.target || i.srcElement, l = o.cloneNode(!0);
      this.config.original_target = n(i), this.config.original_target.target = l, this.config.backup_element = o, o.parentNode.appendChild(l), o.style.display = "none", (this.config.mousemoveContainer || document.body).appendChild(o);
    }
  }, getInputMethods: function() {
    var a = [];
    return a.push({ move: "mousemove", down: "mousedown", up: "mouseup", accessor: function(s) {
      return s;
    } }), e.config.touch && (!e.env.isIE || U.maxTouchPoints ? a.push({ move: "touchmove", down: "touchstart", up: "touchend", accessor: function(s) {
      return s.touches && s.touches.length > 1 ? null : s.touches[0] ? { target: document.elementFromPoint(s.touches[0].clientX, s.touches[0].clientY), pageX: s.touches[0].pageX, pageY: s.touches[0].pageY, clientX: s.touches[0].clientX, clientY: s.touches[0].clientY } : s;
    } }) : U.PointerEvent && a.push({ move: "pointermove", down: "pointerdown", up: "pointerup", accessor: function(s) {
      return s.pointerType == "mouse" ? null : s;
    } })), a;
  }, clearDragTimer: function() {
    this._drag_start_timer && (clearTimeout(this._drag_start_timer), this._drag_start_timer = null);
  }, dragStart: function(a, s, i) {
    this.config && this.config.started || (this.config = { obj: a, marker: null, started: !1, pos: this.getPosition(s), sensitivity: 4 }, this._settings && B(this.config, this._settings, !0), this.traceDragEvents(a, i), e._prevent_touch_scroll = !0, s.target.closest(".gantt_row") && !e.config.order_branch && (e._prevent_touch_scroll = !1), document.body.classList.add("gantt_noselect"), e.config.touch && this.dragMove(a, s, i.accessor));
  }, dragMove: function(a, s, i) {
    var o = i(s);
    if (!o) return !1;
    if (!this.config.marker && !this.config.started) {
      var l = this.getPosition(o);
      if (e.config.touch || this.checkPositionChange(l)) {
        if (this.config.started = !0, this.config.ignore = !1, e._touch_drag = !0, this.callEvent("onBeforeDragStart", [a, this.config.original_target]) === !1) return this.config.ignore = !0, !1;
        this.backupEventTarget(s, i), this.initDnDMarker(), e._touch_feedback(), this.callEvent("onAfterDragStart", [a, this.config.original_target]);
      } else this.config.ignore = !0;
    }
    return this.config.ignore ? !1 : s.targetTouches && !o.target ? void 0 : (o.pos = this.getPosition(o), this.config.marker.style.left = o.pos.x + "px", this.config.marker.style.top = o.pos.y + "px", this.callEvent("onDragMove", [a, o]), !0);
  }, dragEnd: function(a) {
    var s = this.config.backup_element;
    s && s.parentNode && s.parentNode.removeChild(s), e._prevent_touch_scroll = !1, this.config.marker && (this.config.marker.parentNode.removeChild(this.config.marker), this.config.marker = null, this.callEvent("onDragEnd", [])), this.config.started = !1, e._touch_drag = !1, document.body.classList.remove("gantt_noselect");
  }, getPosition: function(a) {
    var s = 0, i = 0;
    return a.pageX || a.pageY ? (s = a.pageX, i = a.pageY) : (a.clientX || a.clientY) && (s = a.clientX + document.body.scrollLeft + document.documentElement.scrollLeft, i = a.clientY + document.body.scrollTop + document.documentElement.scrollTop), { x: s, y: i };
  } }, t;
}
var Rt = function() {
  var e = {};
  return { getState: function(n) {
    if (e[n]) return e[n].method();
    var t = {};
    for (var a in e) e[a].internal || B(t, e[a].method(), !0);
    return t;
  }, registerProvider: function(n, t, a) {
    e[n] = { method: t, internal: a };
  }, unregisterProvider: function(n) {
    delete e[n];
  } };
};
const Nt = Promise;
var z = { $create: function(e) {
  return B(e || [], this);
}, $removeAt: function(e, n) {
  e >= 0 && this.splice(e, n || 1);
}, $remove: function(e) {
  this.$removeAt(this.$find(e));
}, $insertAt: function(e, n) {
  if (n || n === 0) {
    var t = this.splice(n, this.length - n);
    this[n] = e, this.push.apply(this, t);
  } else this.push(e);
}, $find: function(e) {
  for (var n = 0; n < this.length; n++) if (e == this[n]) return n;
  return -1;
}, $each: function(e, n) {
  for (var t = 0; t < this.length; t++) e.call(n || this, this[t]);
}, $map: function(e, n) {
  for (var t = 0; t < this.length; t++) this[t] = e.call(n || this, this[t]);
  return this;
}, $filter: function(e, n) {
  for (var t = 0; t < this.length; t++) e.call(n || this, this[t]) || (this.splice(t, 1), t--);
  return this;
} };
function Re(e, n, t, a) {
  return (a = n ? n.config : a) && a.placeholder_task && t.exists(e) ? t.getItem(e).type === a.types.placeholder : !1;
}
var we = function(e) {
  return this.pull = {}, this.$initItem = e.initItem, this.visibleOrder = z.$create(), this.fullOrder = z.$create(), this._skip_refresh = !1, this._filterRule = null, this._searchVisibleOrder = {}, this._indexRangeCache = {}, this._getItemsCache = null, this.$config = e, ie(this), this._attachDataChange(function() {
    return this._indexRangeCache = {}, this._getItemsCache = null, !0;
  }), this;
};
function W(e) {
  we.call(this, e);
  let n = null;
  const t = () => {
    console.log(`This evaluation version of dhtmlxGantt for Node.js allows loading up to 75 of Tasks or Links.
Records starting from ${JSON.stringify(n)} will be omitted.
Please contact us at contact@dhtmlx.com or visit https://dhtmlx.com/docs/products/dhtmlxGantt in order to obtain a license.`), n = null;
  };
  this.attachEvent("onItemLoading", function(a) {
    return !(this.fullOrder.length >= 75) || (n || (n = a, setTimeout(t)), !1);
  });
}
we.prototype = { _attachDataChange: function(e) {
  this.attachEvent("onClearAll", e), this.attachEvent("onBeforeParse", e), this.attachEvent("onBeforeUpdate", e), this.attachEvent("onBeforeDelete", e), this.attachEvent("onBeforeAdd", e), this.attachEvent("onParse", e), this.attachEvent("onBeforeFilter", e);
}, _parseInner: function(e) {
  for (var n = null, t = [], a = 0, s = e.length; a < s; a++) n = e[a], this.$initItem && (this.$config.copyOnParse() && (n = J(n)), n = this.$initItem(n)), this.callEvent("onItemLoading", [n]) && (this.pull.hasOwnProperty(n.id) || this.fullOrder.push(n.id), t.push(n), this.pull[n.id] = n);
  return t;
}, parse: function(e) {
  this.isSilent() || this.callEvent("onBeforeParse", [e]);
  var n = this._parseInner(e);
  this.isSilent() || (this.refresh(), this.callEvent("onParse", [n]));
}, getItem: function(e) {
  return this.pull[e];
}, _updateOrder: function(e) {
  e.call(this.visibleOrder), e.call(this.fullOrder);
}, updateItem: function(e, n) {
  if (j(n) || (n = this.getItem(e)), !this.isSilent() && this.callEvent("onBeforeUpdate", [n.id, n]) === !1) return !1;
  B(this.pull[e], n, !0), this.isSilent() || (this.callEvent("onAfterUpdate", [n.id, n]), this.callEvent("onStoreUpdated", [n.id, n, "update"]));
}, _removeItemInner: function(e) {
  this._updateOrder(function() {
    this.$remove(e);
  }), delete this.pull[e];
}, removeItem: function(e) {
  var n = this.getItem(e);
  if (!this.isSilent() && this.callEvent("onBeforeDelete", [n.id, n]) === !1) return !1;
  this.callEvent("onAfterDeleteConfirmed", [n.id, n]), this._removeItemInner(e), this.isSilent() && this.callEvent("onAfterSilentDelete", [n.id, n]), this.isSilent() || (this.filter(), this.callEvent("onAfterDelete", [n.id, n]), this.callEvent("onStoreUpdated", [n.id, n, "delete"]));
}, _addItemInner: function(e, n) {
  if (this.exists(e.id)) this.silent(function() {
    this.updateItem(e.id, e);
  });
  else {
    var t = this.visibleOrder, a = t.length;
    (!j(n) || n < 0) && (n = a), n > a && (n = Math.min(t.length, n));
  }
  this.pull[e.id] = e, this._updateOrder(function() {
    this.$find(e.id) === -1 && this.$insertAt(e.id, n);
  }), this.filter();
}, isVisible: function(e) {
  return this.visibleOrder.$find(e) > -1;
}, getVisibleItems: function() {
  return this.getIndexRange();
}, addItem: function(e, n) {
  return j(e.id) || (e.id = se()), this.$initItem && (e = this.$initItem(e)), !(!this.isSilent() && this.callEvent("onBeforeAdd", [e.id, e]) === !1) && (this._addItemInner(e, n), this.isSilent() ? this.sync_link && this.sync_link(e) : (this.callEvent("onAfterAdd", [e.id, e]), this.callEvent("onStoreUpdated", [e.id, e, "add"])), e.id);
}, _changeIdInner: function(e, n) {
  this.pull[e] && (this.pull[n] = this.pull[e]);
  var t = this._searchVisibleOrder[e];
  this.pull[n].id = n, this._updateOrder(function() {
    this[this.$find(e)] = n;
  }), this._searchVisibleOrder[n] = t, delete this._searchVisibleOrder[e], delete this.pull[e];
}, changeId: function(e, n) {
  this._changeIdInner(e, n), this.callEvent("onIdChange", [e, n]);
}, exists: function(e) {
  return !!this.pull[e];
}, _moveInner: function(e, n) {
  var t = this.getIdByIndex(e);
  this._updateOrder(function() {
    this.$removeAt(e), this.$insertAt(t, Math.min(this.length, n));
  });
}, move: function(e, n) {
  var t = this.getIdByIndex(e), a = this.getItem(t);
  this._moveInner(e, n), this.isSilent() || this.callEvent("onStoreUpdated", [a.id, a, "move"]);
}, clearAll: function() {
  this.$destroyed || (this.silent(function() {
    this.unselect();
  }), this.pull = {}, this.visibleOrder = z.$create(), this.fullOrder = z.$create(), this.isSilent() || (this.callEvent("onClearAll", []), this.refresh()));
}, silent: function(e, n) {
  var t = !1;
  this.isSilent() && (t = !0), this._skip_refresh = !0, e.call(n || this), t || (this._skip_refresh = !1);
}, isSilent: function() {
  return !!this._skip_refresh;
}, arraysEqual: function(e, n) {
  if (e.length !== n.length) return !1;
  for (var t = 0; t < e.length; t++) if (e[t] !== n[t]) return !1;
  return !0;
}, refresh: function(e, n) {
  var t, a;
  if (!this.$destroyed && !this.isSilent() && (e && (t = this.getItem(e)), a = e ? [e, t, "paint"] : [null, null, null], this.callEvent("onBeforeStoreUpdate", a) !== !1)) {
    var s = this._quick_refresh && !this._mark_recompute;
    if (this._mark_recompute = !1, e) {
      if (!n && !s) {
        var i = this.visibleOrder;
        this.filter(), this.arraysEqual(i, this.visibleOrder) || (e = void 0);
      }
    } else s || this.filter();
    a = e ? [e, t, "paint"] : [null, null, null], this.callEvent("onStoreUpdated", a);
  }
}, count: function() {
  return this.fullOrder.length;
}, countVisible: function() {
  return this.visibleOrder.length;
}, sort: function(e) {
}, serialize: function() {
}, eachItem: function(e) {
  for (var n = 0; n < this.fullOrder.length; n++) {
    var t = this.getItem(this.fullOrder[n]);
    e.call(this, t);
  }
}, find: function(e) {
  var n = [];
  return this.eachItem(function(t) {
    e(t) && n.push(t);
  }), n;
}, filter: function(e) {
  this.isSilent() || this.callEvent("onBeforeFilter", []), this.callEvent("onPreFilter", []);
  var n = z.$create(), t = [];
  this.eachItem(function(s) {
    this.callEvent("onFilterItem", [s.id, s]) && (Re(s.id, null, this, this._ganttConfig) ? t.push(s.id) : n.push(s.id));
  });
  for (var a = 0; a < t.length; a++) n.push(t[a]);
  for (this.visibleOrder = n, this._searchVisibleOrder = {}, a = 0; a < this.visibleOrder.length; a++) this._searchVisibleOrder[this.visibleOrder[a]] = a;
  this.isSilent() || this.callEvent("onFilter", []);
}, getIndexRange: function(e, n) {
  var t = Math.min(n || 1 / 0, this.countVisible() - 1), a = e || 0, s = a + "-" + t;
  if (this._indexRangeCache[s]) return this._indexRangeCache[s].slice();
  for (var i = [], o = a; o <= t; o++) i.push(this.getItem(this.visibleOrder[o]));
  return this._indexRangeCache[s] = i.slice(), i;
}, getItems: function() {
  if (this._getItemsCache) return this._getItemsCache.slice();
  var e = [];
  for (var n in this.pull) e.push(this.pull[n]);
  return this._getItemsCache = e.slice(), e;
}, getIdByIndex: function(e) {
  return this.visibleOrder[e];
}, getIndexById: function(e) {
  var n = this._searchVisibleOrder[e];
  return n === void 0 && (n = -1), n;
}, _getNullIfUndefined: function(e) {
  return e === void 0 ? null : e;
}, getFirst: function() {
  return this._getNullIfUndefined(this.visibleOrder[0]);
}, getLast: function() {
  return this._getNullIfUndefined(this.visibleOrder[this.visibleOrder.length - 1]);
}, getNext: function(e) {
  return this._getNullIfUndefined(this.visibleOrder[this.getIndexById(e) + 1]);
}, getPrev: function(e) {
  return this._getNullIfUndefined(this.visibleOrder[this.getIndexById(e) - 1]);
}, destructor: function() {
  this.callEvent("onDestroy", []), this.detachAllEvents(), this.$destroyed = !0, this.pull = null, this.$initItem = null, this.visibleOrder = null, this.fullOrder = null, this._skip_refresh = null, this._filterRule = null, this._searchVisibleOrder = null, this._indexRangeCache = {};
} }, W.prototype = Object.create(we.prototype), W.prototype.constructor = W;
class jt {
  constructor(n) {
    this._datastore = null, this.isSplitItem = (t) => t.render == "split" && this._datastore.hasChild(t.id), this.isSubrowSplitItem = (t) => t.split_placement == "subrow", this.isDefaultSplitItem = (t) => t.split_placement == "auto" || t.split_placement === void 0, this.isInlineSplitItem = (t) => t.split_placement == "inline", this._datastore = n;
  }
}
var lt = function(e) {
  var n;
  W.apply(this, [e]), this._branches = {}, this._splitTaskHelper = new jt(this), this.pull = {}, this.$initItem = function(l) {
    var r = l;
    e.initItem && (r = e.initItem(r));
    var d = this.getItem(l.id);
    return d && !Y(d.parent, r.parent) && this.move(r.id, r.$index || -1, r.parent || this._ganttConfig.root_id), r;
  }, this.$parentProperty = e.parentProperty || "parent", typeof e.rootId != "function" ? this.$getRootId = (n = e.rootId || 0, function() {
    return n;
  }) : this.$getRootId = e.rootId, this.$openInitially = e.openInitially, this.visibleOrder = z.$create(), this.fullOrder = z.$create(), this._searchVisibleOrder = {}, this._indexRangeCache = {}, this._eachItemMainRangeCache = null, this._getItemsCache = null, this._skip_refresh = !1, this._ganttConfig = null, e.getConfig && (this._ganttConfig = e.getConfig());
  var t = {}, a = {}, s = {}, i = {}, o = !1;
  return this._attachDataChange(function() {
    return this._indexRangeCache = {}, this._eachItemMainRangeCache = null, this._getItemsCache = null, !0;
  }), this.attachEvent("onPreFilter", function() {
    this._indexRangeCache = {}, this._eachItemMainRangeCache = null, t = {}, a = {}, s = {}, i = {}, o = !1, this.eachItem(function(l) {
      var r = this.getParent(l.id);
      l.$open && s[r] !== !1 ? s[l.id] = !0 : s[l.id] = !1, this._isSplitItem(l) && (o = !0, t[l.id] = !0, a[l.id] = !0), o && a[r] && (this._isDefaultItem(l) || this._isInlineChildItem(l)) && (a[l.id] = !0), s[r] || s[r] === void 0 || this._isInlineChildItem(l) ? i[l.id] = !0 : i[l.id] = !1;
    });
  }), this.attachEvent("onFilterItem", function(l, r) {
    var d = !1;
    this._ganttConfig && (d = this._ganttConfig.open_split_tasks);
    var c = i[r.id];
    return o && (c && a[r.id] && !t[r.id] && (c = !!d), a[r.id] && !t[r.id] && (this._isSplitChildItem(r) || (r.$split_subtask = !0))), r.$expanded_branch = !!i[r.id], this._isInlineChildItem(r) && (c = !1), !!c;
  }), this.attachEvent("onFilter", function() {
    t = {}, a = {}, s = {}, i = {};
  }), this;
};
function Y(e, n) {
  return String(e) === String(n);
}
function H(e) {
  return de.isNode || !e.$root;
}
lt.prototype = B({ _buildTree: function(e) {
  for (var n = null, t = this.$getRootId(), a = 0, s = e.length; a < s; a++) n = e[a], this.setParent(n, K(this.getParent(n), t) || t);
  for (a = 0, s = e.length; a < s; a++) n = e[a], this._add_branch(n), n.$level = this.calculateItemLevel(n), n.$local_index = this.getBranchIndex(n.id), j(n.$open) || (n.$open = j(n.open) ? n.open : this.$openInitially());
  this._updateOrder();
}, _isSplitItem: function(e) {
  return this._splitTaskHelper.isSplitItem(e);
}, _isSplitChildItem: function(e) {
  return this._splitTaskHelper.isSubrowSplitItem(e);
}, _isDefaultItem: function(e) {
  return this._splitTaskHelper.isDefaultSplitItem(e);
}, _isInlineChildItem: function(e) {
  return this._splitTaskHelper.isInlineSplitItem(e);
}, parse: function(e) {
  this._skip_refresh || this.callEvent("onBeforeParse", [e]);
  var n = this._parseInner(e);
  this._buildTree(n), this.filter(), this._skip_refresh || this.callEvent("onParse", [n]);
}, _addItemInner: function(e, n) {
  var t = this.getParent(e);
  j(t) || (t = this.$getRootId(), this.setParent(e, t));
  var a = this.getIndexById(t) + Math.min(Math.max(n, 0), this.visibleOrder.length);
  1 * a !== a && (a = void 0), W.prototype._addItemInner.call(this, e, a), this.setParent(e, t), e.hasOwnProperty("$rendered_parent") && this._move_branch(e, e.$rendered_parent), this._add_branch(e, n);
}, _changeIdInner: function(e, n) {
  var t = this.getChildren(e), a = this._searchVisibleOrder[e];
  W.prototype._changeIdInner.call(this, e, n);
  var s = this.getParent(n);
  this._replace_branch_child(s, e, n), this._branches[e] && (this._branches[n] = this._branches[e]);
  for (var i = 0; i < t.length; i++) {
    var o = this.getItem(t[i]);
    o[this.$parentProperty] = n, o.$rendered_parent = n;
  }
  this._searchVisibleOrder[n] = a, delete this._branches[e];
}, _traverseBranches: function(e, n) {
  j(n) || (n = this.$getRootId());
  var t = this._branches[n];
  if (t) for (var a = 0; a < t.length; a++) {
    var s = t[a];
    e.call(this, s), this._branches[s] && this._traverseBranches(e, s);
  }
}, _updateOrder: function(e) {
  this.fullOrder = z.$create(), this._traverseBranches(function(n) {
    this.fullOrder.push(n);
  }), e && W.prototype._updateOrder.call(this, e);
}, _removeItemInner: function(e) {
  var n = [];
  this.eachItem(function(a) {
    n.push(a);
  }, e), n.push(this.getItem(e));
  for (var t = 0; t < n.length; t++) this._move_branch(n[t], this.getParent(n[t]), null), W.prototype._removeItemInner.call(this, n[t].id), this._move_branch(n[t], this.getParent(n[t]), null);
}, move: function(e, n, t) {
  var a = arguments[3], s = (this._ganttConfig || {}).root_id || 0;
  if (a = K(a, s)) {
    if (a === e) return;
    t = this.getParent(a), n = this.getBranchIndex(a);
  }
  if (!Y(e, t)) {
    j(t) || (t = this.$getRootId());
    var i = this.getItem(e), o = this.getParent(i.id), l = this.getChildren(t);
    if (n == -1 && (n = l.length + 1), Y(o, t) && this.getBranchIndex(e) == n) return;
    if (this.callEvent("onBeforeItemMove", [e, t, n]) === !1) return !1;
    for (var r = [], d = 0; d < l.length; d++) Re(l[d], null, this, this._ganttConfig) && (r.push(l[d]), l.splice(d, 1), d--);
    this._replace_branch_child(o, e);
    var c = (l = this.getChildren(t))[n];
    (c = K(c, s)) ? l = l.slice(0, n).concat([e]).concat(l.slice(n)) : l.push(e), r.length && (l = l.concat(r)), Y(i.$rendered_parent, o) || Y(o, t) || (i.$rendered_parent = o), this.setParent(i, t), this._branches[t] = l;
    var u = this.calculateItemLevel(i) - i.$level;
    i.$level += u, this.eachItem(function(_) {
      _.$level += u;
    }, i.id, this), this._moveInner(this.getIndexById(e), this.getIndexById(t) + n), this.callEvent("onAfterItemMove", [e, t, n]), this.refresh();
  }
}, getBranchIndex: function(e) {
  var n = this.getChildren(this.getParent(e));
  let t = n.indexOf(e + "");
  return t == -1 && (t = n.indexOf(+e)), t;
}, hasChild: function(e) {
  var n = this._branches[e];
  return n && n.length;
}, getChildren: function(e) {
  var n = this._branches[e];
  return n || z.$create();
}, isChildOf: function(e, n) {
  if (!this.exists(e)) return !1;
  if (n === this.$getRootId()) return !0;
  if (!this.hasChild(n)) return !1;
  var t = this.getItem(e), a = this.getParent(e);
  if (this.getItem(n).$level >= t.$level) return !1;
  for (; t && this.exists(a); ) {
    if ((t = this.getItem(a)) && Y(t.id, n)) return !0;
    a = this.getParent(t);
  }
  return !1;
}, getSiblings: function(e) {
  if (!this.exists(e)) return z.$create();
  var n = this.getParent(e);
  return this.getChildren(n);
}, getNextSibling: function(e) {
  for (var n = this.getSiblings(e), t = 0, a = n.length; t < a; t++) if (Y(n[t], e)) {
    var s = n[t + 1];
    return s === 0 && t > 0 && (s = "0"), s || null;
  }
  return null;
}, getPrevSibling: function(e) {
  for (var n = this.getSiblings(e), t = 0, a = n.length; t < a; t++) if (Y(n[t], e)) {
    var s = n[t - 1];
    return s === 0 && t > 0 && (s = "0"), s || null;
  }
  return null;
}, getParent: function(e) {
  var n = null;
  return (n = e.id !== void 0 ? e : this.getItem(e)) ? n[this.$parentProperty] : this.$getRootId();
}, clearAll: function() {
  this._branches = {}, W.prototype.clearAll.call(this);
}, calculateItemLevel: function(e) {
  var n = 0;
  return this.eachParent(function() {
    n++;
  }, e), n;
}, _setParentInner: function(e, n, t) {
  t || (e.hasOwnProperty("$rendered_parent") ? this._move_branch(e, e.$rendered_parent, n) : this._move_branch(e, e[this.$parentProperty], n));
}, setParent: function(e, n, t) {
  this._setParentInner(e, n, t), e[this.$parentProperty] = n;
}, _eachItemCached: function(e, n) {
  for (var t = 0, a = n.length; t < a; t++) e.call(this, n[t]);
}, _eachItemIterate: function(e, n, t) {
  var a = this.getChildren(n);
  for (a.length && (a = a.slice().reverse()); a.length; ) {
    var s = a.pop(), i = this.getItem(s);
    if (e.call(this, i), t && t.push(i), this.hasChild(i.id)) for (var o = this.getChildren(i.id), l = o.length - 1; l >= 0; l--) a.push(o[l]);
  }
}, eachItem: function(e, n) {
  var t = this.$getRootId();
  j(n) || (n = t);
  var a = K(n, t) || t, s = !1, i = !1, o = null;
  a === t && (this._eachItemMainRangeCache ? (s = !0, o = this._eachItemMainRangeCache) : (i = !0, o = this._eachItemMainRangeCache = [])), s ? this._eachItemCached(e, o) : this._eachItemIterate(e, a, i ? o : null);
}, eachParent: function(e, n) {
  for (var t = {}, a = n, s = this.getParent(a); this.exists(s); ) {
    if (t[s]) throw new Error("Invalid tasks tree. Cyclic reference has been detected on task " + s);
    t[s] = !0, a = this.getItem(s), e.call(this, a), s = this.getParent(a);
  }
}, _add_branch: function(e, n, t) {
  var a = t === void 0 ? this.getParent(e) : t;
  this.hasChild(a) || (this._branches[a] = z.$create());
  var s = this.getChildren(a);
  s.indexOf(e.id + "") > -1 || s.indexOf(+e.id) > -1 || (1 * n == n ? s.splice(n, 0, e.id) : s.push(e.id), e.$rendered_parent = a);
}, _move_branch: function(e, n, t) {
  this._eachItemMainRangeCache = null, this._replace_branch_child(n, e.id), this.exists(t) || Y(t, this.$getRootId()) ? this._add_branch(e, void 0, t) : delete this._branches[e.id], e.$level = this.calculateItemLevel(e), this.eachItem(function(a) {
    a.$level = this.calculateItemLevel(a);
  }, e.id);
}, _replace_branch_child: function(e, n, t) {
  var a = this.getChildren(e);
  if (a && e !== void 0) {
    var s = z.$create();
    let i = a.indexOf(n + "");
    i != -1 || isNaN(+n) || (i = a.indexOf(+n)), i > -1 && (t ? a.splice(i, 1, t) : a.splice(i, 1)), s = a, this._branches[e] = s;
  }
}, sort: function(e, n, t) {
  this.exists(t) || (t = this.$getRootId()), e || (e = "order");
  var a = typeof e == "string" ? function(r, d) {
    return r[e] == d[e] || G(r[e]) && G(d[e]) && r[e].valueOf() == d[e].valueOf() ? 0 : r[e] > d[e] ? 1 : -1;
  } : e;
  if (n) {
    var s = a;
    a = function(r, d) {
      return s(d, r);
    };
  }
  var i = this.getChildren(t);
  if (i) {
    for (var o = [], l = i.length - 1; l >= 0; l--) o[l] = this.getItem(i[l]);
    for (o.sort(a), l = 0; l < o.length; l++) i[l] = o[l].id, this.sort(e, n, i[l]);
  }
}, filter: function(e) {
  for (let n in this.pull) {
    const t = this.pull[n].$rendered_parent, a = this.getParent(this.pull[n]);
    Y(t, a) || this._move_branch(this.pull[n], t, a);
  }
  return W.prototype.filter.apply(this, arguments);
}, open: function(e) {
  this.exists(e) && (this.getItem(e).$open = !0, this._skipTaskRecalculation = !0, this.callEvent("onItemOpen", [e]));
}, close: function(e) {
  this.exists(e) && (this.getItem(e).$open = !1, this._skipTaskRecalculation = !0, this.callEvent("onItemClose", [e]));
}, destructor: function() {
  W.prototype.destructor.call(this), this._branches = null, this._indexRangeCache = {}, this._eachItemMainRangeCache = null;
} }, W.prototype);
const Bt = function(e, n) {
  const t = n.getDatastore(e), a = function(l, r) {
    const d = r.getLayers(), c = t.getItem(l);
    if (c && t.isVisible(l)) for (let u = 0; u < d.length; u++) d[u].render_item(c);
  }, s = function(l) {
    const r = l.getLayers();
    for (let h = 0; h < r.length; h++) r[h].clear();
    let d = null;
    const c = {};
    for (let h = 0; h < r.length; h++) {
      const g = r[h];
      let p;
      if (g.get_visible_range) {
        var u = g.get_visible_range(t);
        if (u.start !== void 0 && u.end !== void 0) {
          var _ = u.start + " - " + u.end;
          c[_] ? p = c[_] : (p = t.getIndexRange(u.start, u.end), c[_] = p);
        } else {
          if (u.ids === void 0) throw new Error("Invalid range returned from 'getVisibleRange' of the layer");
          p = u.ids.map(function(k) {
            return t.getItem(k);
          });
        }
      } else d || (d = t.getVisibleItems()), p = d;
      g.prepare_data && g.prepare_data(p), r[h].render_items(p);
    }
  }, i = function(l) {
    if (l.update_items) {
      let d = [];
      if (l.get_visible_range) {
        var r = l.get_visible_range(t);
        if (r.start !== void 0 && r.end !== void 0 && (d = t.getIndexRange(r.start, r.end)), r.ids !== void 0) {
          let c = r.ids.map(function(u) {
            return t.getItem(u);
          });
          c.length > 0 && (c = c.filter((u) => u !== void 0), d = d.concat(c));
        }
        if ((r.start == null || r.end == null) && r.ids == null) throw new Error("Invalid range returned from 'getVisibleRange' of the layer");
      } else d = t.getVisibleItems();
      l.prepare_data && l.prepare_data(d, l), l.update_items(d);
    }
  };
  function o(l) {
    return !!l.$services.getService("state").getState("batchUpdate").batch_update;
  }
  t.attachEvent("onStoreUpdated", function(l, r, d) {
    if (H(n)) return !0;
    const c = n.$services.getService("layers").getDataRender(e);
    c && (c.onUpdateRequest = function(u) {
      i(u);
    });
  }), t.attachEvent("onStoreUpdated", function(l, r, d) {
    o(n) || (l && d != "move" && d != "delete" ? (t.callEvent("onBeforeRefreshItem", [r.id]), t.callEvent("onAfterRefreshItem", [r.id])) : (t.callEvent("onBeforeRefreshAll", []), t.callEvent("onAfterRefreshAll", [])));
  }), t.attachEvent("onAfterRefreshAll", function() {
    if (H(n)) return !0;
    const l = n.$services.getService("layers").getDataRender(e);
    l && !o(n) && s(l);
  }), t.attachEvent("onAfterRefreshItem", function(l) {
    if (H(n)) return !0;
    const r = n.$services.getService("layers").getDataRender(e);
    r && a(l, r);
  }), t.attachEvent("onItemOpen", function() {
    if (H(n) || t.isSilent()) return !0;
    n.render();
  }), t.attachEvent("onItemClose", function() {
    if (H(n) || t.isSilent()) return !0;
    n.render();
  }), t.attachEvent("onIdChange", function(l, r) {
    if (H(n)) return !0;
    if (t.callEvent("onBeforeIdChange", [l, r]), !o(n) && !t.isSilent()) {
      const d = n.$services.getService("layers").getDataRender(e);
      d ? (function(c, u, _) {
        for (let h = 0; h < c.length; h++) c[h].change_id(u, _);
      }(d.getLayers(), l, r, t.getItem(r)), a(r, d)) : n.render();
    }
  });
};
function ve() {
  for (var e = this.$services.getService("datastores"), n = [], t = 0; t < e.length; t++) {
    var a = this.getDatastore(e[t]);
    a.$destroyed || n.push(a);
  }
  return n;
}
const Ut = { create: function() {
  var e = B({}, { createDatastore: function(n) {
    var t = (n.type || "").toLowerCase() == "treedatastore" ? lt : W;
    if (n) {
      var a = this;
      n.openInitially = function() {
        return a.config.open_tree_initially;
      }, n.copyOnParse = function() {
        return a.config.deepcopy_on_parse;
      };
    }
    var s = new t(n);
    if (this.mixin(s, function(l) {
      var r = null, d = l._removeItemInner;
      function c(u) {
        r = null, this.callEvent("onAfterUnselect", [u]);
      }
      return l._removeItemInner = function(u) {
        return r == u && c.call(this, u), r && this.eachItem && this.eachItem(function(_) {
          _.id == r && c.call(this, _.id);
        }, u), d.apply(this, arguments);
      }, l.attachEvent("onIdChange", function(u, _) {
        l.getSelectedId() == u && l.silent(function() {
          l.unselect(u), l.select(_);
        });
      }), { select: function(u) {
        if (u) {
          if (r == u) return r;
          if (!this._skip_refresh && !this.callEvent("onBeforeSelect", [u])) return !1;
          this.unselect(), r = u, this._skip_refresh || (this.refresh(u), this.callEvent("onAfterSelect", [u]));
        }
        return r;
      }, getSelectedId: function() {
        return r;
      }, isSelected: function(u) {
        return u == r;
      }, unselect: function(u) {
        (u = u || r) && (r = null, this._skip_refresh || (this.refresh(u), c.call(this, u)));
      } };
    }(s)), n.name) {
      var i = "datastore:" + n.name;
      s.attachEvent("onDestroy", (function() {
        this.$services.dropService(i);
        for (var l = this.$services.getService("datastores"), r = 0; r < l.length; r++) if (l[r] === n.name) {
          l.splice(r, 1);
          break;
        }
      }).bind(this)), this.$services.dropService(i), this.$services.setService(i, function() {
        return s;
      });
      var o = this.$services.getService("datastores");
      o ? o.indexOf(n.name) < 0 && o.push(n.name) : (o = [], this.$services.setService("datastores", function() {
        return o;
      }), o.push(n.name)), Bt(n.name, this);
    }
    return s;
  }, getDatastore: function(n) {
    return this.$services.getService("datastore:" + n);
  }, _getDatastores: ve, refreshData: function() {
    var n;
    H(this) || (n = this.getScrollState()), this.callEvent("onBeforeDataRender", []);
    for (var t = ve.call(this), a = 0; a < t.length; a++) t[a].refresh();
    this.config.preserve_scroll && !H(this) && ((n.x || n.y) && this.scrollTo(n.x, n.y), this.$layout.getScrollbarsInfo().forEach((s) => {
      const i = this.$ui.getView(s.id);
      if (!i) return;
      const o = this.utils.dom.isChildOf(i.$view, this.$container);
      s.boundViews.forEach((l) => {
        const r = this.$ui.getView(l);
        s.y && r && !o && r.scrollTo(void 0, 0);
      });
    })), this.callEvent("onDataRender", []);
  }, isChildOf: function(n, t) {
    return this.$data.tasksStore.isChildOf(n, t);
  }, refreshTask: function(n, t) {
    var a = this.getTask(n), s = this;
    function i() {
      if (t === void 0 || t) {
        for (var l = 0; l < a.$source.length; l++) s.refreshLink(a.$source[l]);
        for (l = 0; l < a.$target.length; l++) s.refreshLink(a.$target[l]);
      }
    }
    if (a && this.isTaskVisible(n)) this.$data.tasksStore.refresh(n, !!this.getState("tasksDnd").drag_id || t === !1), i();
    else if (this.isTaskExists(n) && this.isTaskExists(this.getParent(n)) && !this._bulk_dnd) {
      this.refreshTask(this.getParent(n));
      var o = !1;
      this.eachParent(function(l) {
        (o || this.isSplitTask(l)) && (o = !0);
      }, n), o && i();
    }
  }, refreshLink: function(n) {
    this.$data.linksStore.refresh(n, !!this.getState("tasksDnd").drag_id);
  }, silent: function(n) {
    var t = this;
    t.$data.tasksStore.silent(function() {
      t.$data.linksStore.silent(function() {
        n();
      });
    });
  }, clearAll: function() {
    for (var n = ve.call(this), t = 0; t < n.length; t++) n[t].silent(function() {
      n[t].clearAll();
    });
    for (t = 0; t < n.length; t++) n[t].clearAll();
    this._update_flags(), this.userdata = {}, this.callEvent("onClear", []), this.render();
  }, _clear_data: function() {
    this.$data.tasksStore.clearAll(), this.$data.linksStore.clearAll(), this._update_flags(), this.userdata = {};
  }, selectTask: function(n) {
    var t = this.$data.tasksStore;
    if (!this.config.select_task) return !1;
    if (n = K(n, this.config.root_id)) {
      let a = this.getSelectedId();
      t._skipResourceRepaint = !0, t.select(n), t._skipResourceRepaint = !1, a && t.pull[a].$split_subtask && a != n && this.refreshTask(a), t.pull[n].$split_subtask && a != n && this.refreshTask(n);
    }
    return t.getSelectedId();
  }, unselectTask: function(n) {
    var t = this.$data.tasksStore;
    t.unselect(n), n && t.pull[n].$split_subtask && this.refreshTask(n);
  }, isSelectedTask: function(n) {
    return this.$data.tasksStore.isSelected(n);
  }, getSelectedId: function() {
    return this.$data.tasksStore.getSelectedId();
  } });
  return B(e, { getTask: function(n) {
    n = K(n, this.config.root_id), this.assert(n, "Invalid argument for gantt.getTask");
    var t = this.$data.tasksStore.getItem(n);
    return this.assert(t, "Task not found id=" + n), t;
  }, getTaskByTime: function(n, t) {
    var a = this.$data.tasksStore.getItems(), s = [];
    if (n || t) {
      n = +n || -1 / 0, t = +t || 1 / 0;
      for (var i = 0; i < a.length; i++) {
        var o = a[i];
        +o.start_date < t && +o.end_date > n && s.push(o);
      }
    } else s = a;
    return s;
  }, isTaskExists: function(n) {
    return !(!this.$data || !this.$data.tasksStore) && this.$data.tasksStore.exists(n);
  }, updateTask: function(n, t) {
    j(t) || (t = this.getTask(n)), this.$data.tasksStore.updateItem(n, t), this.isTaskExists(n) && this.refreshTask(n);
  }, addTask: function(n, t, a) {
    if (j(n.id) || (n.id = se()), this.isTaskExists(n.id) && this.getTask(n.id).$index != n.$index) return n.start_date && typeof n.start_date == "string" && (n.start_date = this.date.parseDate(n.start_date, "parse_date")), n.end_date && typeof n.end_date == "string" && (n.end_date = this.date.parseDate(n.end_date, "parse_date")), this.$data.tasksStore.updateItem(n.id, n);
    if (j(t) || (t = this.getParent(n) || 0), this.isTaskExists(t) || (t = this.config.root_id), this.setParent(n, t), this.getState().lightbox && this.isTaskExists(t)) {
      var s = this.getTask(t);
      this.callEvent("onAfterParentExpand", [t, s]);
    }
    return this.$data.tasksStore.addItem(n, a, t);
  }, deleteTask: function(n) {
    return n = K(n, this.config.root_id), this.$data.tasksStore.removeItem(n);
  }, getTaskCount: function() {
    return this.$data.tasksStore.count();
  }, getVisibleTaskCount: function() {
    return this.$data.tasksStore.countVisible();
  }, getTaskIndex: function(n) {
    return this.$data.tasksStore.getBranchIndex(n);
  }, getGlobalTaskIndex: function(n) {
    return n = K(n, this.config.root_id), this.assert(n, "Invalid argument"), this.$data.tasksStore.getIndexById(n);
  }, eachTask: function(n, t, a) {
    return this.$data.tasksStore.eachItem(O(n, a || this), t);
  }, eachParent: function(n, t, a) {
    return this.$data.tasksStore.eachParent(O(n, a || this), t);
  }, changeTaskId: function(n, t) {
    this.$data.tasksStore.changeId(n, t);
    var a = this.$data.tasksStore.getItem(t), s = [];
    a.$source && (s = s.concat(a.$source)), a.$target && (s = s.concat(a.$target));
    for (var i = 0; i < s.length; i++) {
      var o = this.getLink(s[i]);
      o.source == n && (o.source = t), o.target == n && (o.target = t);
    }
  }, calculateTaskLevel: function(n) {
    return this.$data.tasksStore.calculateItemLevel(n);
  }, getNext: function(n) {
    return this.$data.tasksStore.getNext(n);
  }, getPrev: function(n) {
    return this.$data.tasksStore.getPrev(n);
  }, getParent: function(n) {
    return this.$data.tasksStore.getParent(n);
  }, setParent: function(n, t, a) {
    return this.$data.tasksStore.setParent(n, t, a);
  }, getSiblings: function(n) {
    return this.$data.tasksStore.getSiblings(n).slice();
  }, getNextSibling: function(n) {
    return this.$data.tasksStore.getNextSibling(n);
  }, getPrevSibling: function(n) {
    return this.$data.tasksStore.getPrevSibling(n);
  }, getTaskByIndex: function(n) {
    var t = this.$data.tasksStore.getIdByIndex(n);
    return this.isTaskExists(t) ? this.getTask(t) : null;
  }, getChildren: function(n) {
    return this.hasChild(n) ? this.$data.tasksStore.getChildren(n).slice() : [];
  }, hasChild: function(n) {
    return this.$data.tasksStore.hasChild(n);
  }, open: function(n) {
    this.$data.tasksStore.open(n);
  }, close: function(n) {
    this.$data.tasksStore.close(n);
  }, moveTask: function(n, t, a) {
    return a = K(a, this.config.root_id), this.$data.tasksStore.move.apply(this.$data.tasksStore, arguments);
  }, sort: function(n, t, a, s) {
    var i = !s;
    this.$data.tasksStore.sort(n, t, a), this.callEvent("onAfterSort", [n, t, a]), i && this.render();
  } }), B(e, { getLinkCount: function() {
    return this.$data.linksStore.count();
  }, getLink: function(n) {
    return this.$data.linksStore.getItem(n);
  }, getLinks: function() {
    return this.$data.linksStore.getItems();
  }, isLinkExists: function(n) {
    return this.$data.linksStore.exists(n);
  }, addLink: function(n) {
    return this.$data.linksStore.addItem(n);
  }, updateLink: function(n, t) {
    j(t) || (t = this.getLink(n)), this.$data.linksStore.updateItem(n, t);
  }, deleteLink: function(n) {
    return this.$data.linksStore.removeItem(n);
  }, changeLinkId: function(n, t) {
    return this.$data.linksStore.changeId(n, t);
  } }), e;
} };
function Wt(e) {
  var n = function(c) {
    const u = new at(c).primaryScale();
    let _ = u.unit, h = u.step;
    if (c.config.scale_offset_minimal) {
      const g = new st(c), p = [g.primaryScale()].concat(g.getAdditionalScales());
      g.sortScales(p), _ = p[p.length - 1].unit, h = p[p.length - 1].step || 1;
    }
    return { unit: _, step: h };
  }(e), t = n.unit, a = n.step, s = function(c, u) {
    var _ = { start_date: null, end_date: null };
    if (u.config.start_date && u.config.end_date) {
      _.start_date = u.date[c + "_start"](new Date(u.config.start_date));
      var h = new Date(u.config.end_date), g = u.date[c + "_start"](new Date(h));
      h = +h != +g ? u.date.add(g, 1, c) : g, _.end_date = h;
    }
    return _;
  }(t, e);
  if (!s.start_date || !s.end_date) {
    for (var i = !0, o = e.getTaskByTime(), l = 0; l < o.length; l++)
      if (o[l].type !== e.config.types.project) {
        i = !1;
        break;
      }
    if (o.length && i) {
      var r = o[0].start_date, d = e.date.add(r, 1, e.config.duration_unit);
      s = { start_date: new Date(r), end_date: new Date(d) };
    } else s = e.getSubtaskDates();
    s.start_date && s.end_date || (s = { start_date: /* @__PURE__ */ new Date(), end_date: /* @__PURE__ */ new Date() }), e.eachTask(function(c) {
      e.config.deadlines && c.deadline && ye(s, c.deadline, c.deadline), c.constraint_date && c.constraint_type && e._getAutoSchedulingConfig().apply_constraints && e.config.constraint_types && c.constraint_type !== e.config.constraint_types.ASAP && c.constraint_type !== e.config.constraint_types.ALAP && ye(s, c.constraint_date, c.constraint_date), e.config.baselines && c.baselines && c.baselines.forEach(function(u) {
        ye(s, u.start_date, u.end_date);
      });
    }), s.start_date = e.date[t + "_start"](s.start_date), s.start_date = e.calculateEndDate({ start_date: e.date[t + "_start"](s.start_date), duration: -1, unit: t, step: a }), s.end_date = e.date[t + "_start"](s.end_date), s.end_date = e.calculateEndDate({ start_date: s.end_date, duration: 2, unit: t, step: a });
  }
  e._min_date = s.start_date, e._max_date = s.end_date;
}
function ye(e, n, t) {
  n < e.start_date && (e.start_date = new Date(n)), t > e.end_date && (e.end_date = new Date(t));
}
function Ce(e) {
  Wt(e), function(n) {
    if (n.config.fit_tasks) {
      var t = +n._min_date, a = +n._max_date;
      if (+n._min_date != t || +n._max_date != a) return n.render(), n.callEvent("onScaleAdjusted", []), !0;
    }
  }(e);
}
function qe(e, n, t) {
  for (var a = 0; a < n.length; a++) e.isLinkExists(n[a]) && (t[n[a]] = e.getLink(n[a]));
}
function Xe(e, n, t) {
  qe(e, n.$source, t), qe(e, n.$target, t);
}
const Ee = { getSubtreeLinks: function(e, n) {
  var t = {};
  return e.isTaskExists(n) && Xe(e, e.getTask(n), t), e.eachTask(function(a) {
    Xe(e, a, t);
  }, n), t;
}, getSubtreeTasks: function(e, n) {
  var t = {};
  return e.eachTask(function(a) {
    t[a.id] = a;
  }, n), t;
} };
class Ft {
  constructor(n, t) {
    this.$gantt = n, this.$dp = t, this._dataProcessorHandlers = [];
  }
  attach() {
    const n = this.$dp, t = this.$gantt, a = {}, s = (l) => this.clientSideDelete(l, n, t);
    this._dataProcessorHandlers.push(t.attachEvent("onAfterTaskAdd", function(l, r) {
      t.isTaskExists(l) && (n.setGanttMode("tasks"), n.setUpdated(l, !0, "inserted"));
    })), this._dataProcessorHandlers.push(t.attachEvent("onAfterTaskUpdate", function(l, r) {
      t.isTaskExists(l) && (n.setGanttMode("tasks"), n.setUpdated(l, !0), t._sendTaskOrder && t._sendTaskOrder(l, r));
    })), this._dataProcessorHandlers.push(t.attachEvent("onBeforeTaskDelete", function(l, r) {
      return t.config.cascade_delete && (a[l] = { tasks: Ee.getSubtreeTasks(t, l), links: Ee.getSubtreeLinks(t, l) }), !n.deleteAfterConfirmation || (n.setGanttMode("tasks"), n.setUpdated(l, !0, "deleted"), !1);
    })), this._dataProcessorHandlers.push(t.attachEvent("onAfterTaskDelete", function(l, r) {
      n.setGanttMode("tasks");
      const d = !s(l), c = t.config.cascade_delete && a[l];
      if (d || c) {
        if (c) {
          const u = n.updateMode;
          n.setUpdateMode("off");
          const _ = a[l];
          for (const h in _.tasks) s(h) || (n.storeItem(_.tasks[h]), n.setUpdated(h, !0, "deleted"));
          n.setGanttMode("links");
          for (const h in _.links) s(h) || (n.storeItem(_.links[h]), n.setUpdated(h, !0, "deleted"));
          a[l] = null, u !== "off" && n.sendAllData(), n.setGanttMode("tasks"), n.setUpdateMode(u);
        }
        d && (n.storeItem(r), n.deleteAfterConfirmation || n.setUpdated(l, !0, "deleted")), n.updateMode === "off" || n._tSend || n.sendAllData();
      }
    })), this._dataProcessorHandlers.push(t.attachEvent("onAfterLinkUpdate", function(l, r) {
      t.isLinkExists(l) && (n.setGanttMode("links"), n.setUpdated(l, !0));
    })), this._dataProcessorHandlers.push(t.attachEvent("onAfterLinkAdd", function(l, r) {
      t.isLinkExists(l) && (n.setGanttMode("links"), n.setUpdated(l, !0, "inserted"));
    })), this._dataProcessorHandlers.push(t.attachEvent("onAfterLinkDelete", function(l, r) {
      n.setGanttMode("links"), !s(l) && (n.storeItem(r), n.setUpdated(l, !0, "deleted"));
    })), this._dataProcessorHandlers.push(t.attachEvent("onRowDragEnd", function(l, r) {
      t._sendTaskOrder(l, t.getTask(l));
    }));
    let i = null, o = null;
    this._dataProcessorHandlers.push(t.attachEvent("onTaskIdChange", function(l, r) {
      if (!n._waitMode) return;
      const d = t.getChildren(r);
      if (d.length) {
        i = i || {};
        for (let u = 0; u < d.length; u++) {
          const _ = this.getTask(d[u]);
          i[_.id] = _;
        }
      }
      const c = function(u) {
        let _ = [];
        return u.$source && (_ = _.concat(u.$source)), u.$target && (_ = _.concat(u.$target)), _;
      }(this.getTask(r));
      if (c.length) {
        o = o || {};
        for (let u = 0; u < c.length; u++) {
          const _ = this.getLink(c[u]);
          o[_.id] = _;
        }
      }
    })), n.attachEvent("onAfterUpdateFinish", function() {
      (i || o) && (t.batchUpdate(function() {
        for (const l in i) t.updateTask(i[l].id);
        for (const l in o) t.updateLink(o[l].id);
        i = null, o = null;
      }), i ? t._dp.setGanttMode("tasks") : t._dp.setGanttMode("links"));
    }), n.attachEvent("onBeforeDataSending", function() {
      if (this._tMode === "CUSTOM") return !0;
      let l = this._serverProcessor;
      if (this._tMode === "REST-JSON" || this._tMode === "REST") {
        const r = this._ganttMode;
        l = l.substring(0, l.indexOf("?") > -1 ? l.indexOf("?") : l.length), this.serverProcessor = l + (l.slice(-1) === "/" ? "" : "/") + r;
      } else {
        const r = this._ganttMode + "s";
        this.serverProcessor = l + t.ajax.urlSeparator(l) + "gantt_mode=" + r;
      }
      return !0;
    }), n.attachEvent("insertCallback", function(l, r, d, c) {
      const u = l.data || t.xml._xmlNodeToJSON(l.firstChild), _ = { add: t.addTask, isExist: t.isTaskExists };
      c === "links" && (_.add = t.addLink, _.isExist = t.isLinkExists), _.isExist.call(t, r) || (u.id = r, _.add.call(t, u));
    }), n.attachEvent("updateCallback", function(l, r) {
      const d = l.data || t.xml._xmlNodeToJSON(l.firstChild);
      if (!t.isTaskExists(r)) return;
      const c = t.getTask(r);
      for (const u in d) {
        let _ = d[u];
        switch (u) {
          case "id":
            continue;
          case "start_date":
          case "end_date":
            _ = t.defined(t.templates.xml_date) ? t.templates.xml_date(_) : t.templates.parse_date(_);
            break;
          case "duration":
            c.end_date = t.calculateEndDate({ start_date: c.start_date, duration: _, task: c });
        }
        c[u] = _;
      }
      t.updateTask(r), t.refreshData();
    }), n.attachEvent("deleteCallback", function(l, r, d, c) {
      const u = { delete: t.deleteTask, isExist: t.isTaskExists };
      c === "links" ? (u.delete = t.deleteLink, u.isExist = t.isLinkExists) : c === "assignment" && (u.delete = function(_) {
        t.$data.assignmentsStore.remove(_);
      }, u.isExist = function(_) {
        return t.$data.assignmentsStore.exists(_);
      }), u.isExist.call(t, r) && u.delete.call(t, r);
    }), this.handleResourceCRUD(n, t), this.handleResourceAssignmentCRUD(n, t), this.handleBaselineCRUD(n, t);
  }
  clientSideDelete(n, t, a) {
    const s = t.updatedRows.slice();
    let i = !1;
    a.getUserData(n, "!nativeeditor_status", t._ganttMode) === "true_deleted" && (i = !0, t.setUpdated(n, !1));
    for (let o = 0; o < s.length && !t._in_progress[n]; o++) s[o] === n && (a.getUserData(n, "!nativeeditor_status", t._ganttMode) === "inserted" && (i = !0), t.setUpdated(n, !1));
    return i;
  }
  handleResourceAssignmentCRUD(n, t) {
    if (!t.config.resources || t.config.resources.dataprocessor_assignments !== !0) return;
    const a = t.getDatastore(t.config.resource_assignment_store), s = {}, i = {};
    function o(l) {
      const r = l.id;
      a.exists(r) && (n.setGanttMode("assignment"), n.setUpdated(r, !0, "inserted")), delete i[r];
    }
    t.attachEvent("onBeforeTaskAdd", function(l, r) {
      return s[l] = !0, !0;
    }), t.attachEvent("onTaskIdChange", function(l, r) {
      delete s[l];
    }), a.attachEvent("onAfterAdd", (l, r) => {
      s[r.task_id] ? function(d) {
        i[d.id] = d, s[d.task_id] = !0;
      }(r) : o(r);
    }), a.attachEvent("onAfterUpdate", (l, r) => {
      a.exists(l) && (i[l] ? o(r) : (n.setGanttMode("assignment"), n.setUpdated(l, !0)));
    }), a.attachEvent("onAfterDelete", (l, r) => {
      n.setGanttMode("assignment"), !this.clientSideDelete(l, n, t) && (n.storeItem(r), n.setUpdated(l, !0, "deleted"));
    });
  }
  handleResourceCRUD(n, t) {
    if (!t.config.resources || t.config.resources.dataprocessor_resources !== !0) return;
    const a = t.getDatastore(t.config.resource_store);
    a.attachEvent("onAfterAdd", (s, i) => {
      (function(o) {
        const l = o.id;
        a.exists(l) && (n.setGanttMode("resource"), n.setUpdated(l, !0, "inserted"));
      })(i);
    }), a.attachEvent("onAfterUpdate", (s, i) => {
      a.exists(s) && (n.setGanttMode("resource"), n.setUpdated(s, !0));
    }), a.attachEvent("onAfterDelete", (s, i) => {
      n.setGanttMode("resource"), !this.clientSideDelete(s, n, t) && (n.storeItem(i), n.setUpdated(s, !0, "deleted"));
    });
  }
  handleBaselineCRUD(n, t) {
    if (!t.config.baselines || t.config.baselines.dataprocessor_baselines !== !0) return;
    const a = t.getDatastore(t.config.baselines.datastore);
    a.attachEvent("onAfterAdd", (s, i) => {
      (function(o) {
        const l = o.id;
        a.exists(l) && (n.setGanttMode("baseline"), n.setUpdated(l, !0, "inserted"));
      })(i);
    }), a.attachEvent("onAfterUpdate", (s, i) => {
      a.exists(s) && (n.setGanttMode("baseline"), n.setUpdated(s, !0));
    }), a.attachEvent("onAfterDelete", (s, i) => {
      n.setGanttMode("baseline"), !this.clientSideDelete(s, n, t) && (n.storeItem(i), n.setUpdated(s, !0, "deleted"));
    });
  }
  detach() {
    Q(this._dataProcessorHandlers, (n) => {
      this.$gantt.detachEvent(n);
    }), this._dataProcessorHandlers = [];
  }
}
const _e = class _e {
  constructor() {
    this.clear = () => {
      this._storage = {};
    }, this.storeItem = (n) => {
      this._storage[n.id] = J(n);
    }, this.getStoredItem = (n) => this._storage[n] || null, this._storage = {};
  }
};
_e.create = () => new _e();
let ue = _e, dt = class {
  constructor(e) {
    this.serverProcessor = e, this.action_param = "!nativeeditor_status", this.updatedRows = [], this.autoUpdate = !0, this.updateMode = "cell", this._headers = null, this._payload = null, this._postDelim = "_", this._routerParametersFormat = "parameters", this._waitMode = 0, this._in_progress = {}, this._storage = ue.create(), this._invalid = {}, this.messages = [], this.styles = { updated: "font-weight:bold;", inserted: "font-weight:bold;", deleted: "text-decoration : line-through;", invalid: "background-color:FFE0E0;", invalid_cell: "border-bottom:2px solid red;", error: "color:red;", clear: "font-weight:normal;text-decoration:none;" }, this.enableUTFencoding(!0), ie(this);
  }
  setTransactionMode(e, n) {
    typeof e == "object" ? (this._tMode = e.mode || this._tMode, j(e.headers) && (this._headers = e.headers), j(e.payload) && (this._payload = e.payload), this._tSend = !!n) : (this._tMode = e, this._tSend = n), this._tMode === "REST" && (this._tSend = !1), this._tMode === "JSON" || this._tMode === "REST-JSON" ? (this._tSend = !1, this._serializeAsJson = !0, this._headers = this._headers || {}, this._headers["Content-Type"] = "application/json") : this._headers && !this._headers["Content-Type"] && (this._headers["Content-Type"] = "application/x-www-form-urlencoded"), this._tMode === "CUSTOM" && (this._tSend = !1, this._router = e.router);
  }
  escape(e) {
    return this._utf ? encodeURIComponent(e) : escape(e);
  }
  enableUTFencoding(e) {
    this._utf = !!e;
  }
  getSyncState() {
    return !this.updatedRows.length;
  }
  setUpdateMode(e, n) {
    this.autoUpdate = e === "cell", this.updateMode = e, this.dnd = n;
  }
  ignore(e, n) {
    this._silent_mode = !0, e.call(n || U), this._silent_mode = !1;
  }
  setUpdated(e, n, t) {
    if (this._silent_mode) return;
    const a = this.findRow(e);
    t = t || "updated";
    const s = this.$gantt.getUserData(e, this.action_param, this._ganttMode);
    s && t === "updated" && (t = s), n ? (this.set_invalid(e, !1), this.updatedRows[a] = e, this.$gantt.setUserData(e, this.action_param, t, this._ganttMode), this._in_progress[e] && (this._in_progress[e] = "wait")) : this.is_invalid(e) || (this.updatedRows.splice(a, 1), this.$gantt.setUserData(e, this.action_param, "", this._ganttMode)), this.markRow(e, n, t), n && this.autoUpdate && this.sendData(e);
  }
  markRow(e, n, t) {
    let a = "";
    const s = this.is_invalid(e);
    if (s && (a = this.styles[s], n = !0), this.callEvent("onRowMark", [e, n, t, s]) && (a = this.styles[n ? t : "clear"] + " " + a, this.$gantt[this._methods[0]](e, a), s && s.details)) {
      a += this.styles[s + "_cell"];
      for (let i = 0; i < s.details.length; i++) s.details[i] && this.$gantt[this._methods[1]](e, i, a);
    }
  }
  getActionByState(e) {
    return e === "inserted" ? "create" : e === "updated" ? "update" : e === "deleted" ? "delete" : "update";
  }
  getState(e) {
    return this.$gantt.getUserData(e, this.action_param, this._ganttMode);
  }
  is_invalid(e) {
    return this._invalid[e];
  }
  set_invalid(e, n, t) {
    t && (n = { value: n, details: t, toString: function() {
      return this.value.toString();
    } }), this._invalid[e] = n;
  }
  checkBeforeUpdate(e) {
    return !0;
  }
  sendData(e) {
    if (this.$gantt.editStop && this.$gantt.editStop(), e === void 0 || this._tSend) {
      const n = [];
      if (this.modes && ["task", "link", "assignment", "baseline"].forEach((t) => {
        this.modes[t] && this.modes[t].updatedRows.length && n.push(t);
      }), n.length) {
        for (let t = 0; t < n.length; t++) this.setGanttMode(n[t]), this.sendAllData();
        return;
      }
      return this.sendAllData();
    }
    return !this._in_progress[e] && (this.messages = [], !(!this.checkBeforeUpdate(e) && this.callEvent("onValidationError", [e, this.messages])) && void this._beforeSendData(this._getRowData(e), e));
  }
  serialize(e, n) {
    if (this._serializeAsJson) return this._serializeAsJSON(e);
    if (typeof e == "string") return e;
    if (n !== void 0) return this.serialize_one(e, "");
    {
      const t = [], a = [];
      for (const s in e) e.hasOwnProperty(s) && (t.push(this.serialize_one(e[s], s + this._postDelim)), a.push(s));
      return t.push("ids=" + this.escape(a.join(","))), this.$gantt.security_key && t.push("dhx_security=" + this.$gantt.security_key), t.join("&");
    }
  }
  serialize_one(e, n) {
    if (typeof e == "string") return e;
    const t = [];
    let a = "";
    for (const s in e) if (e.hasOwnProperty(s)) {
      if ((s === "id" || s == this.action_param) && this._tMode === "REST") continue;
      a = typeof e[s] == "string" || typeof e[s] == "number" ? String(e[s]) : JSON.stringify(e[s]), t.push(this.escape((n || "") + s) + "=" + this.escape(a));
    }
    return t.join("&");
  }
  sendAllData() {
    if (!this.updatedRows.length) return;
    this.messages = [];
    let e = !0;
    if (this._forEachUpdatedRow(function(n) {
      e = e && this.checkBeforeUpdate(n);
    }), !e && !this.callEvent("onValidationError", ["", this.messages])) return !1;
    this._tSend ? this._sendData(this._getAllData()) : this._forEachUpdatedRow(function(n) {
      if (!this._in_progress[n]) {
        if (this.is_invalid(n)) return;
        this._beforeSendData(this._getRowData(n), n);
      }
    });
  }
  findRow(e) {
    let n = 0;
    for (n = 0; n < this.updatedRows.length && e != this.updatedRows[n]; n++) ;
    return n;
  }
  defineAction(e, n) {
    this._uActions || (this._uActions = {}), this._uActions[e] = n;
  }
  afterUpdateCallback(e, n, t, a, s) {
    if (!this.$gantt) return;
    this.setGanttMode(s);
    const i = e, o = t !== "error" && t !== "invalid";
    if (o || this.set_invalid(e, t), this._uActions && this._uActions[t] && !this._uActions[t](a)) return delete this._in_progress[i];
    this._in_progress[i] !== "wait" && this.setUpdated(e, !1);
    const l = e;
    switch (t) {
      case "inserted":
      case "insert":
        n != e && (this.setUpdated(e, !1), this.$gantt[this._methods[2]](e, n), e = n);
        break;
      case "delete":
      case "deleted":
        if (this.deleteAfterConfirmation && this._ganttMode === "task") {
          if (this._ganttMode === "task" && this.$gantt.isTaskExists(e)) {
            this.$gantt.setUserData(e, this.action_param, "true_deleted", this._ganttMode);
            const r = this.$gantt.getTask(e);
            this.$gantt.silent(() => {
              this.$gantt.deleteTask(e);
            }), this.$gantt.callEvent("onAfterTaskDelete", [e, r]), this.$gantt.render(), delete this._in_progress[i];
          }
          return this.callEvent("onAfterUpdate", [e, t, n, a]);
        }
        return this.$gantt.setUserData(e, this.action_param, "true_deleted", this._ganttMode), this.$gantt[this._methods[3]](e), delete this._in_progress[i], this.callEvent("onAfterUpdate", [e, t, n, a]);
    }
    this._in_progress[i] !== "wait" ? (o && this.$gantt.setUserData(e, this.action_param, "", this._ganttMode), delete this._in_progress[i]) : (delete this._in_progress[i], this.setUpdated(n, !0, this.$gantt.getUserData(e, this.action_param, this._ganttMode))), this.callEvent("onAfterUpdate", [l, t, n, a]);
  }
  afterUpdate(e, n, t) {
    let a;
    a = arguments.length === 3 ? arguments[1] : arguments[4];
    let s = this.getGanttMode();
    const i = a.filePath || a.url;
    s = this._tMode !== "REST" && this._tMode !== "REST-JSON" ? i.indexOf("gantt_mode=links") !== -1 ? "link" : i.indexOf("gantt_mode=assignments") !== -1 ? "assignment" : i.indexOf("gantt_mode=baselines") !== -1 ? "baseline" : "task" : i.indexOf("/link") >= 0 ? "link" : i.indexOf("/assignment") >= 0 ? "assignment" : i.indexOf("/baseline") >= 0 ? "baseline" : "task", this.setGanttMode(s);
    const o = this.$gantt.ajax;
    let l;
    try {
      l = JSON.parse(n.xmlDoc.responseText);
    } catch {
      n.xmlDoc.responseText.length || (l = {});
    }
    const r = (u) => {
      const _ = l.action || this.getState(u) || "updated", h = l.sid || u[0], g = l.tid || u[0];
      e.afterUpdateCallback(h, g, _, l, s);
    };
    if (l) return Array.isArray(t) && t.length > 1 ? t.forEach((u) => r(u)) : r(t), e.finalizeUpdate(), void this.setGanttMode(s);
    const d = o.xmltop("data", n.xmlDoc);
    if (!d) return this.cleanUpdate(t);
    const c = o.xpath("//data/action", d);
    if (!c.length) return this.cleanUpdate(t);
    for (let u = 0; u < c.length; u++) {
      const _ = c[u], h = _.getAttribute("type"), g = _.getAttribute("sid"), p = _.getAttribute("tid");
      e.afterUpdateCallback(g, p, h, _, s);
    }
    e.finalizeUpdate();
  }
  cleanUpdate(e) {
    if (e) for (let n = 0; n < e.length; n++) delete this._in_progress[e[n]];
  }
  finalizeUpdate() {
    this._waitMode && this._waitMode--, this.callEvent("onAfterUpdateFinish", []), this.updatedRows.length || this.callEvent("onFullSync", []);
  }
  init(e) {
    if (this._initialized) return;
    this.$gantt = e, this.$gantt._dp_init && this.$gantt._dp_init(this), this._setDefaultTransactionMode(), this.styles = { updated: "gantt_updated", order: "gantt_updated", inserted: "gantt_inserted", deleted: "gantt_deleted", delete_confirmation: "gantt_deleted", invalid: "gantt_invalid", error: "gantt_error", clear: "" }, this._methods = ["_row_style", "setCellTextStyle", "_change_id", "_delete_task"], function(t, a) {
      t.getUserData = function(s, i, o) {
        return this.userdata || (this.userdata = {}), this.userdata[o] = this.userdata[o] || {}, this.userdata[o][s] && this.userdata[o][s][i] ? this.userdata[o][s][i] : "";
      }, t.setUserData = function(s, i, o, l) {
        this.userdata || (this.userdata = {}), this.userdata[l] = this.userdata[l] || {}, this.userdata[l][s] = this.userdata[l][s] || {}, this.userdata[l][s][i] = o;
      }, t._change_id = function(s, i) {
        switch (this._dp._ganttMode) {
          case "task":
            this.changeTaskId(s, i);
            break;
          case "link":
            this.changeLinkId(s, i);
            break;
          case "assignment":
            this.$data.assignmentsStore.changeId(s, i);
            break;
          case "resource":
            this.$data.resourcesStore.changeId(s, i);
            break;
          case "baseline":
            this.$data.baselineStore.changeId(s, i);
            break;
          default:
            throw new Error(`Invalid mode of the dataProcessor after database id is received: ${this._dp._ganttMode}, new id: ${i}`);
        }
      }, t._row_style = function(s, i) {
        this._dp._ganttMode === "task" && t.isTaskExists(s) && (t.getTask(s).$dataprocessor_class = i, t.refreshTask(s));
      }, t._delete_task = function(s, i) {
      }, t._sendTaskOrder = function(s, i) {
        i.$drop_target && (this._dp.setGanttMode("task"), this.getTask(s).target = i.$drop_target, this._dp.setUpdated(s, !0, "order"), delete this.getTask(s).$drop_target);
      }, t.setDp = function() {
        this._dp = a;
      }, t.setDp();
    }(this.$gantt, this);
    const n = new Ft(this.$gantt, this);
    n.attach(), this.attachEvent("onDestroy", function() {
      delete this.setGanttMode, delete this._getRowData, delete this.$gantt._dp, delete this.$gantt._change_id, delete this.$gantt._row_style, delete this.$gantt._delete_task, delete this.$gantt._sendTaskOrder, delete this.$gantt, n.detach();
    }), this.$gantt.callEvent("onDataProcessorReady", [this]), this._initialized = !0;
  }
  setOnAfterUpdate(e) {
    this.attachEvent("onAfterUpdate", e);
  }
  setOnBeforeUpdateHandler(e) {
    this.attachEvent("onBeforeDataSending", e);
  }
  setAutoUpdate(e, n) {
    e = e || 2e3, this._user = n || (/* @__PURE__ */ new Date()).valueOf(), this._needUpdate = !1, this._updateBusy = !1, this.attachEvent("onAfterUpdate", this.afterAutoUpdate), this.attachEvent("onFullSync", this.fullSync), setInterval(() => {
      this.loadUpdate();
    }, e);
  }
  afterAutoUpdate(e, n, t, a) {
    return n !== "collision" || (this._needUpdate = !0, !1);
  }
  fullSync() {
    return this._needUpdate && (this._needUpdate = !1, this.loadUpdate()), !0;
  }
  getUpdates(e, n) {
    const t = this.$gantt.ajax;
    if (this._updateBusy) return !1;
    this._updateBusy = !0, t.get(e, n);
  }
  loadUpdate() {
    const e = this.$gantt.ajax, n = this.$gantt.getUserData(0, "version", this._ganttMode);
    let t = this.serverProcessor + e.urlSeparator(this.serverProcessor) + ["dhx_user=" + this._user, "dhx_version=" + n].join("&");
    t = t.replace("editing=true&", ""), this.getUpdates(t, (a) => {
      const s = e.xpath("//userdata", a);
      this.$gantt.setUserData(0, "version", this._getXmlNodeValue(s[0]), this._ganttMode);
      const i = e.xpath("//update", a);
      if (i.length) {
        this._silent_mode = !0;
        for (let o = 0; o < i.length; o++) {
          const l = i[o].getAttribute("status"), r = i[o].getAttribute("id"), d = i[o].getAttribute("parent");
          switch (l) {
            case "inserted":
              this.callEvent("insertCallback", [i[o], r, d]);
              break;
            case "updated":
              this.callEvent("updateCallback", [i[o], r, d]);
              break;
            case "deleted":
              this.callEvent("deleteCallback", [i[o], r, d]);
          }
        }
        this._silent_mode = !1;
      }
      this._updateBusy = !1;
    });
  }
  destructor() {
    this.callEvent("onDestroy", []), this.detachAllEvents(), this.updatedRows = [], this._in_progress = {}, this._invalid = {}, this._storage.clear(), this._storage = null, this._headers = null, this._payload = null, delete this._initialized;
  }
  setGanttMode(e) {
    e === "tasks" ? e = "task" : e === "links" && (e = "link");
    const n = this.modes || {}, t = this.getGanttMode();
    t && (n[t] = { _in_progress: this._in_progress, _invalid: this._invalid, _storage: this._storage, updatedRows: this.updatedRows });
    let a = n[e];
    a || (a = n[e] = { _in_progress: {}, _invalid: {}, _storage: ue.create(), updatedRows: [] }), this._in_progress = a._in_progress, this._invalid = a._invalid, this._storage = a._storage, this.updatedRows = a.updatedRows, this.modes = n, this._ganttMode = e;
  }
  getGanttMode() {
    return this._ganttMode;
  }
  storeItem(e) {
    this._storage.storeItem(e);
  }
  url(e) {
    this.serverProcessor = this._serverProcessor = e;
  }
  _beforeSendData(e, n) {
    if (!this.callEvent("onBeforeUpdate", [n, this.getState(n), e])) return !1;
    this._sendData(e, n);
  }
  _serializeAsJSON(e) {
    if (typeof e == "string") return e;
    const n = J(e);
    return this._tMode === "REST-JSON" && (delete n.id, delete n[this.action_param]), JSON.stringify(n);
  }
  _applyPayload(e) {
    const n = this.$gantt.ajax;
    if (this._payload) for (const t in this._payload) e = e + n.urlSeparator(e) + this.escape(t) + "=" + this.escape(this._payload[t]);
    return e;
  }
  _cleanupArgumentsBeforeSend(e) {
    let n;
    if (e[this.action_param] === void 0) {
      n = {};
      for (const t in e) n[t] = this._cleanupArgumentsBeforeSend(e[t]);
    } else n = this._cleanupItemBeforeSend(e);
    return n;
  }
  _cleanupItemBeforeSend(e) {
    let n = null;
    return e && (e[this.action_param] === "deleted" ? (n = {}, n.id = e.id, n[this.action_param] = e[this.action_param]) : n = e), n;
  }
  _sendData(e, n) {
    if (!e) return;
    if (!this.callEvent("onBeforeDataSending", n ? [n, this.getState(n), e] : [null, null, e])) return !1;
    n && (this._in_progress[n] = (/* @__PURE__ */ new Date()).valueOf());
    const t = this.$gantt.ajax;
    if (this._tMode === "CUSTOM") {
      const r = this.getState(n), d = this.getActionByState(r);
      delete e[this.action_param];
      const c = this.getGanttMode(), u = (h) => {
        let g = r || "updated", p = n, k = n;
        h && (g = h.action || r, p = h.sid || p, k = h.id || h.tid || k), this.afterUpdateCallback(p, k, g, h, c);
      };
      let _;
      if (this._router instanceof Function) if (this._routerParametersFormat === "object") {
        const h = { entity: c, action: d, data: e, id: n };
        _ = this._router(h);
      } else _ = this._router(c, d, e, n);
      else if (this._router[c] instanceof Function) _ = this._router[c](d, e, n);
      else {
        const h = "Incorrect configuration of gantt.createDataProcessor", g = `
You need to either add missing properties to the dataProcessor router object or to use a router function.
See https://docs.dhtmlx.com/gantt/desktop__server_side.html#customrouting and https://docs.dhtmlx.com/gantt/api__gantt_createdataprocessor.html for details.`;
        if (!this._router[c]) throw new Error(`${h}: router for the **${c}** entity is not defined. ${g}`);
        switch (r) {
          case "inserted":
            if (!this._router[c].create) throw new Error(`${h}: **create** action for the **${c}** entity is not defined. ${g}`);
            _ = this._router[c].create(e);
            break;
          case "deleted":
            if (!this._router[c].delete) throw new Error(`${h}: **delete** action for the **${c}** entity is not defined. ${g}`);
            _ = this._router[c].delete(n);
            break;
          default:
            if (!this._router[c].update) throw new Error(`${h}: **update**" action for the **${c}** entity is not defined. ${g}`);
            _ = this._router[c].update(e, n);
        }
      }
      if (_) {
        if (!_.then && _.id === void 0 && _.tid === void 0 && _.action === void 0) throw new Error("Incorrect router return value. A Promise or a response object is expected");
        _.then ? _.then(u).catch((h) => {
          h && h.action ? u(h) : u({ action: "error", value: h });
        }) : u(_);
      } else u(null);
      return;
    }
    let a;
    a = { callback: (r) => {
      const d = [];
      if (n) d.push(n);
      else if (e) for (const c in e) d.push(c);
      return this.afterUpdate(this, r, d);
    }, headers: this._headers };
    const s = "dhx_version=" + this.$gantt.getUserData(0, "version", this._ganttMode), i = this.serverProcessor + (this._user ? t.urlSeparator(this.serverProcessor) + ["dhx_user=" + this._user, s].join("&") : "");
    let o, l = this._applyPayload(i);
    switch (this._tMode) {
      case "GET":
        o = this._cleanupArgumentsBeforeSend(e), a.url = l + t.urlSeparator(l) + this.serialize(o, n), a.method = "GET";
        break;
      case "POST":
        o = this._cleanupArgumentsBeforeSend(e), a.url = l, a.method = "POST", a.data = this.serialize(o, n);
        break;
      case "JSON":
        o = {};
        const r = this._cleanupItemBeforeSend(e);
        for (const d in r) d !== this.action_param && d !== "id" && d !== "gr_id" && (o[d] = r[d]);
        a.url = l, a.method = "POST", a.data = JSON.stringify({ id: n, action: e[this.action_param], data: o });
        break;
      case "REST":
      case "REST-JSON":
        switch (l = i.replace(/(&|\?)editing=true/, ""), o = "", this.getState(n)) {
          case "inserted":
            a.method = "POST", a.data = this.serialize(e, n);
            break;
          case "deleted":
            a.method = "DELETE", l = l + (l.slice(-1) === "/" ? "" : "/") + n;
            break;
          default:
            a.method = "PUT", a.data = this.serialize(e, n), l = l + (l.slice(-1) === "/" ? "" : "/") + n;
        }
        a.url = this._applyPayload(l);
    }
    return this._waitMode++, t.query(a);
  }
  _forEachUpdatedRow(e) {
    const n = this.updatedRows.slice();
    for (let t = 0; t < n.length; t++) {
      const a = n[t];
      this.$gantt.getUserData(a, this.action_param, this._ganttMode) && e.call(this, a);
    }
  }
  _setDefaultTransactionMode() {
    this.serverProcessor && (this.setTransactionMode("POST", !0), this.serverProcessor += (this.serverProcessor.indexOf("?") !== -1 ? "&" : "?") + "editing=true", this._serverProcessor = this.serverProcessor);
  }
  _getXmlNodeValue(e) {
    return e.firstChild ? e.firstChild.nodeValue : "";
  }
  _getAllData() {
    const e = {};
    let n = !1;
    return this._forEachUpdatedRow(function(t) {
      if (this._in_progress[t] || this.is_invalid(t)) return;
      const a = this._getRowData(t);
      this.callEvent("onBeforeUpdate", [t, this.getState(t), a]) && (e[t] = a, n = !0, this._in_progress[t] = (/* @__PURE__ */ new Date()).valueOf());
    }), n ? e : null;
  }
  _prepareDate(e) {
    return this.$gantt.defined(this.$gantt.templates.xml_format) ? this.$gantt.templates.xml_format(e) : this.$gantt.templates.format_date(e);
  }
  _prepareArray(e, n) {
    return n.push(e), e.map((t) => G(t) ? this._prepareDate(t) : Array.isArray(t) && !re(n, t) ? this._prepareArray(t, n) : t && typeof t == "object" && !re(n, t) ? this._prepareObject(t, n) : t);
  }
  _prepareObject(e, n) {
    const t = {};
    n.push(e);
    for (const a in e) {
      if (a.substr(0, 1) === "$") continue;
      const s = e[a];
      G(s) ? t[a] = this._prepareDate(s) : s === null ? t[a] = "" : Array.isArray(s) && !re(n, s) ? t[a] = this._prepareArray(s, n) : s && typeof s == "object" && !re(n, s) ? t[a] = this._prepareObject(s, n) : t[a] = s;
    }
    return t;
  }
  _prepareDataItem(e) {
    const n = this._prepareObject(e, []);
    return n[this.action_param] = this.$gantt.getUserData(e.id, this.action_param, this._ganttMode), n;
  }
  getStoredItem(e) {
    return this._storage.getStoredItem(e);
  }
  _getRowData(e) {
    let n;
    const t = this.$gantt;
    return this.getGanttMode() === "task" ? t.isTaskExists(e) && (n = this.$gantt.getTask(e)) : this.getGanttMode() === "assignment" ? this.$gantt.$data.assignmentsStore.exists(e) && (n = this.$gantt.$data.assignmentsStore.getItem(e)) : this.getGanttMode() === "baseline" ? this.$gantt.$data.baselineStore.exists(e) && (n = this.$gantt.$data.baselineStore.getItem(e)) : t.isLinkExists(e) && (n = this.$gantt.getLink(e)), n || (n = this.getStoredItem(e)), n || (n = { id: e }), this._prepareDataItem(n);
  }
};
const Ht = function(e) {
  return new dt(e);
}, zt = function(e) {
  let n, t, a;
  e instanceof Function ? n = e : e.hasOwnProperty("router") ? n = e.router : e.hasOwnProperty("assignment") || e.hasOwnProperty("baseline") || e.hasOwnProperty("link") || e.hasOwnProperty("task") ? n = e : e.hasOwnProperty("headers") && (a = e.headers), t = n ? "CUSTOM" : e.mode || "REST-JSON";
  const s = new dt(e.url);
  return s.init(this), s.setTransactionMode({ mode: t, router: n, headers: a }, e.batchUpdate), e.deleteAfterConfirmation && (s.deleteAfterConfirmation = e.deleteAfterConfirmation), s;
};
function Gt(e) {
  var n = {}, t = !1;
  function a(r, d) {
    d = typeof d == "function" ? d : function() {
    }, n[r] || (n[r] = this[r], this[r] = d);
  }
  function s(r) {
    n[r] && (this[r] = n[r], n[r] = null);
  }
  function i(r) {
    for (var d in r) a.call(this, d, r[d]);
  }
  function o() {
    for (var r in n) s.call(this, r);
  }
  function l(r) {
    try {
      r();
    } catch (d) {
      U.console.error(d);
    }
  }
  return e.$services.getService("state").registerProvider("batchUpdate", function() {
    return { batch_update: t };
  }, !1), function(r, d) {
    if (t) l(r);
    else {
      var c, u = this._dp && this._dp.updateMode != "off";
      u && (c = this._dp.updateMode, this._dp.setUpdateMode("off"));
      var _ = {}, h = { render: !0, refreshData: !0, refreshTask: !0, refreshLink: !0, resetProjectDates: function(p) {
        _[p.id] = p;
      } };
      for (var g in i.call(this, h), t = !0, this.callEvent("onBeforeBatchUpdate", []), l(r), this.callEvent("onAfterBatchUpdate", []), o.call(this), _) this.resetProjectDates(_[g]);
      t = !1, d || this.render(), u && (this._dp.setUpdateMode(c), this._dp.setGanttMode("task"), this._dp.sendData(), this._dp.setGanttMode("link"), this._dp.sendData());
    }
  };
}
function Jt(e) {
  e.batchUpdate = Gt(e);
}
function Vt(e) {
  const n = /* @__PURE__ */ function(a) {
    return { _needRecalc: !0, reset: function() {
      this._needRecalc = !0;
    }, _isRecalcNeeded: function() {
      return !this._isGroupSort() && this._needRecalc;
    }, _isGroupSort: function() {
      return !!a.getState().group_mode;
    }, _getWBSCode: function(s) {
      return s ? (this._isRecalcNeeded() && this._calcWBS(), s.$virtual ? "" : this._isGroupSort() ? s.$wbs || "" : (s.$wbs || (this.reset(), this._calcWBS()), s.$wbs)) : "";
    }, _setWBSCode: function(s, i) {
      s.$wbs = i;
    }, getWBSCode: function(s) {
      return this._getWBSCode(s);
    }, getByWBSCode: function(s) {
      let i = s.split("."), o = a.config.root_id;
      for (let l = 0; l < i.length; l++) {
        const r = a.getChildren(o);
        let d = 1 * i[l] - 1;
        if (!a.isTaskExists(r[d])) return null;
        o = r[d];
      }
      return a.isTaskExists(o) ? a.getTask(o) : null;
    }, _calcWBS: function() {
      if (!this._isRecalcNeeded()) return;
      let s = !0;
      a.eachTask(function(i) {
        if (i.type == a.config.types.placeholder) return;
        if (s) return s = !1, void this._setWBSCode(i, "1");
        const o = this._getPrevNonPlaceholderSibling(i.id);
        if (o !== null) this._increaseWBS(i, o);
        else {
          let l = a.getParent(i.id);
          this._setWBSCode(i, a.getTask(l).$wbs + ".1");
        }
      }, a.config.root_id, this), this._needRecalc = !1;
    }, _increaseWBS: function(s, i) {
      let o = a.getTask(i).$wbs;
      o && (o = o.split("."), o[o.length - 1]++, this._setWBSCode(s, o.join(".")));
    }, _getPrevNonPlaceholderSibling: function(s) {
      let i, o = s;
      do
        i = a.getPrevSibling(o), o = i;
      while (i !== null && a.getTask(i).type == a.config.types.placeholder);
      return i;
    } };
  }(e);
  function t() {
    return n.reset(), !0;
  }
  e.getWBSCode = function(a) {
    return n.getWBSCode(a);
  }, e.getTaskByWBSCode = function(a) {
    return n.getByWBSCode(a);
  }, e.attachEvent("onAfterTaskMove", t), e.attachEvent("onBeforeParse", t), e.attachEvent("onAfterTaskDelete", t), e.attachEvent("onAfterTaskAdd", t), e.attachEvent("onAfterSort", t);
}
function Yt(e) {
  var n = {}, t = !1;
  e.$data.tasksStore.attachEvent("onStoreUpdated", function() {
    n = {}, t = !1;
  }), e.attachEvent("onBeforeGanttRender", function() {
    n = {};
  });
  var a = String(Math.random());
  function s(r) {
    return r === null ? a + String(r) : String(r);
  }
  function i(r, d, c) {
    return Array.isArray(r) ? r.map(function(u) {
      return s(u);
    }).join("_") + `_${d}_${c}` : s(r) + `_${d}_${c}`;
  }
  function o(r, d, c) {
    var u, _ = i(d, r, JSON.stringify(c)), h = {};
    return Q(d, function(g) {
      h[s(g)] = !0;
    }), n[_] ? u = n[_] : (u = n[_] = [], e.eachTask(function(g) {
      if (c) {
        if (!c[e.getTaskType(g)]) return;
      } else if (g.type == e.config.types.project) return;
      r in g && Q(ce(g[r]) ? g[r] : [g[r]], function(p) {
        var k = p && p.resource_id ? p.resource_id : p;
        if (h[s(k)]) u.push(g);
        else if (!t) {
          var v = i(p, r);
          n[v] || (n[v] = []), n[v].push(g);
        }
      });
    }), t = !0), u;
  }
  function l(r, d, c) {
    var u = e.config.resource_property, _ = [];
    if (e.getDatastore("task").exists(d)) {
      var h = e.getTask(d);
      _ = h[u] || [];
    }
    Array.isArray(_) || (_ = [_]);
    for (var g = 0; g < _.length; g++) _[g].resource_id == r && c.push({ task_id: h.id, resource_id: _[g].resource_id, value: _[g].value });
  }
  return { getTaskBy: function(r, d, c) {
    return typeof r == "function" ? (u = r, _ = [], e.eachTask(function(h) {
      u(h) && _.push(h);
    }), _) : ce(d) ? o(r, d, c) : o(r, [d], c);
    var u, _;
  }, getResourceAssignments: function(r, d) {
    var c = [], u = e.config.resource_property;
    return d !== void 0 ? l(r, d, c) : e.getTaskBy(u, r).forEach(function(_) {
      l(r, _.id, c);
    }), c;
  } };
}
function Kt(e) {
  const n = { renderEditableLabel: function(t, a, s, i, o) {
    const l = e.config.readonly ? "" : "contenteditable";
    if (t < s.end_date && a > s.start_date) {
      for (let r = 0; r < o.length; r++) {
        const d = o[r];
        return "<div " + l + " data-assignment-cell data-assignment-id='" + d.id + "' data-row-id='" + s.id + "' data-task='" + s.$task_id + "' data-start-date='" + e.templates.format_date(t) + "' data-end-date='" + e.templates.format_date(a) + "'>" + d.value + "</div>";
      }
      return "<div " + l + " data-assignment-cell data-empty  data-row-id='" + s.id + "' data-resource-id='" + s.$resource_id + "' data-task='" + s.$task_id + "' data-start-date='" + e.templates.format_date(t) + "''  data-end-date='" + e.templates.format_date(a) + "'>-</div>";
    }
    return "";
  }, renderSummaryLabel: function(t, a, s, i, o) {
    let l = o.reduce(function(r, d) {
      return r + Number(d.value);
    }, 0);
    return l % 1 && (l = Math.round(10 * l) / 10), l ? "<div>" + l + "</div>" : "";
  }, editableResourceCellTemplate: function(t, a, s, i, o) {
    return s.$role === "task" ? n.renderEditableLabel(t, a, s, i, o) : n.renderSummaryLabel(t, a, s, i, o);
  }, editableResourceCellClass: function(t, a, s, i, o) {
    const l = [];
    l.push("resource_marker"), s.$role === "task" ? l.push("task_cell") : l.push("resource_cell");
    const r = o.reduce(function(c, u) {
      return c + Number(u.value);
    }, 0);
    let d = Number(s.capacity);
    return isNaN(d) && (d = 8), r <= d ? l.push("workday_ok") : l.push("workday_over"), l.join(" ");
  }, getSummaryResourceAssignments: function(t) {
    let a;
    const s = e.getDatastore(e.config.resource_store), i = s.getItem(t);
    return i.$role === "task" ? a = e.getResourceAssignments(i.$resource_id, i.$task_id) : (a = e.getResourceAssignments(t), s.eachItem && s.eachItem(function(o) {
      o.$role !== "task" && (a = a.concat(e.getResourceAssignments(o.id)));
    }, t)), a;
  }, initEditableDiagram: function() {
    e.config.resource_render_empty_cells = !0, function() {
      let s = null;
      function i() {
        return s && cancelAnimationFrame(s), s = requestAnimationFrame(function() {
          e.$container && Array.prototype.slice.call(e.$container.querySelectorAll(".resourceTimeline_cell [data-assignment-cell]")).forEach(function(o) {
            o.contentEditable = !0;
          });
        }), !0;
      }
      e.attachEvent("onGanttReady", function() {
        e.getDatastore(e.config.resource_assignment_store).attachEvent("onStoreUpdated", i), e.getDatastore(e.config.resource_store).attachEvent("onStoreUpdated", i);
      }, { once: !0 }), e.attachEvent("onGanttLayoutReady", function() {
        e.$layout.getCellsByType("viewCell").forEach(function(o) {
          o.$config && o.$config.view === "resourceTimeline" && o.$content && o.$content.attachEvent("onScroll", i);
        });
      });
    }();
    let t = null;
    function a(s, i) {
      let o = i || s.target.closest(".resourceTimeline_cell [data-assignment-cell]");
      if (o) {
        let l = (o.innerText || "").trim();
        l == "-" && (l = "0");
        let r = Number(l), d = o.getAttribute("data-row-id"), c = o.getAttribute("data-assignment-id"), u = o.getAttribute("data-task"), _ = o.getAttribute("data-resource-id"), h = e.templates.parse_date(o.getAttribute("data-start-date")), g = e.templates.parse_date(o.getAttribute("data-end-date"));
        const p = e.getDatastore(e.config.resource_assignment_store);
        if (isNaN(r)) e.getDatastore(e.config.resource_store).refresh(d);
        else {
          const k = e.getTask(u);
          if (c) {
            e.plugins().undo && e.ext.undo.saveState(u, "task");
            const v = p.getItem(c);
            if (!v || r === v.value) return;
            if (v.start_date.valueOf() === h.valueOf() && v.end_date.valueOf() === g.valueOf()) v.value = r, r ? p.updateItem(v.id) : p.removeItem(v.id);
            else {
              if (v.end_date.valueOf() > g.valueOf()) {
                const f = e.copy(v);
                f.id = e.uid(), f.start_date = g, f.duration = e.calculateDuration({ start_date: f.start_date, end_date: f.end_date, task: k }), f.delay = e.calculateDuration({ start_date: k.start_date, end_date: f.start_date, task: k }), f.mode = v.mode || "default", f.duration !== 0 && p.addItem(f);
              }
              v.start_date.valueOf() < h.valueOf() ? (v.end_date = h, v.duration = e.calculateDuration({ start_date: v.start_date, end_date: v.end_date, task: k }), v.mode = "fixedDuration", v.duration === 0 ? p.removeItem(v.id) : p.updateItem(v.id)) : p.removeItem(v.id), r && p.addItem({ task_id: v.task_id, resource_id: v.resource_id, value: r, start_date: h, end_date: g, duration: e.calculateDuration({ start_date: h, end_date: g, task: k }), delay: e.calculateDuration({ start_date: k.start_date, end_date: h, task: k }), mode: "fixedDuration" });
            }
            e.updateTaskAssignments(k.id), e.updateTask(k.id);
          } else if (r) {
            let v = { task_id: u, resource_id: _, value: r, start_date: h, end_date: g, duration: e.calculateDuration({ start_date: h, end_date: g, task: k }), delay: e.calculateDuration({ start_date: k.start_date, end_date: h, task: k }), mode: "fixedDuration" };
            p.addItem(v), e.updateTaskAssignments(k.id), e.updateTask(k.id);
          }
        }
      }
    }
    e.attachEvent("onGanttReady", function() {
      let s = null;
      e.event(e.$container, "keypress", function(i) {
        let o = i.target.closest(".resourceTimeline_cell [data-assignment-cell]");
        o && (i.keyCode !== 13 && i.keyCode !== 27 || (o.blur(), a(i)), s = i.target);
      }), e.event(e.$container, "keydown", function(i) {
        i.key === "Tab" && (t = Ye(e.$container).indexOf(document.activeElement), a(i), setTimeout(function() {
          var r;
          const l = Ye(e.$container);
          t > -1 && ((r = l[t + 1]) == null || r.focus());
        }, 300));
      }), e.event(e.$container, "click", function(i) {
        if (s && (a(i, s), s = null, i.target.hasAttribute("data-assignment-id"))) {
          const o = e.$container.querySelectorAll("[contenteditable='true']"), l = Array.from(o).find((r) => r.getAttribute("data-start-date") == i.target.getAttribute("data-start-date") && r.getAttribute("data-assignment-id") == i.target.getAttribute("data-assignment-id"));
          setTimeout(() => {
            const r = e.$container.querySelectorAll("[contenteditable='true']"), d = Array.from(r).find((c) => c.getAttribute("data-start-date") == l.getAttribute("data-start-date") && c.getAttribute("data-row-id") == l.getAttribute("data-row-id"));
            d && d.focus();
          }, 400);
        }
      });
    }, { once: !0 });
  } };
  return n;
}
function qt(e) {
  var n = Yt(e);
  e.ext.resources = Kt(e), e.config.resources = { dataprocessor_assignments: !1, dataprocessor_resources: !1, editable_resource_diagram: !1, resource_store: { type: "treeDataStore", fetchTasks: !1, initItem: function(s) {
    return s.parent = s.parent || e.config.root_id, s[e.config.resource_property] = s.parent, s.open = !0, s;
  } }, lightbox_resources: function(s) {
    const i = [], o = e.getDatastore(e.config.resource_store);
    return s.forEach(function(l) {
      if (!o.hasChild(l.id)) {
        const r = e.copy(l);
        r.key = l.id, r.label = l.text, i.push(r);
      }
    }), i;
  } }, e.attachEvent("onBeforeGanttReady", function() {
    if (e.getDatastore(e.config.resource_store)) return;
    const s = e.config.resources ? e.config.resources.resource_store : void 0;
    let i = s ? s.fetchTasks : void 0;
    e.config.resources && e.config.resources.editable_resource_diagram && (i = !0);
    let o = function(r) {
      return r.parent = r.parent || e.config.root_id, r[e.config.resource_property] = r.parent, r.open = !0, r;
    };
    s && s.initItem && (o = s.initItem);
    const l = s && s.type ? s.type : "treeDatastore";
    e.$resourcesStore = e.createDatastore({ name: e.config.resource_store, type: l, fetchTasks: i !== void 0 && i, initItem: o }), e.$data.resourcesStore = e.$resourcesStore, e.$resourcesStore.attachEvent("onParse", function() {
      let r, d = function(c) {
        const u = [];
        return c.forEach(function(_) {
          const h = e.copy(_);
          h.key = _.id, h.label = _.text, u.push(h);
        }), u;
      };
      e.config.resources && e.config.resources.lightbox_resources && (d = e.config.resources.lightbox_resources), e.config.resources && e.config.resources.editable_resource_diagram ? r = d(e.$resourcesStore.getItems().filter((c) => {
        let u = e.getResourceAssignments(c.id);
        if (!e.$resourcesStore.hasChild(c.id) || u && u.length) return !c.$resource_id || !c.$task_id;
      })) : r = d(e.$resourcesStore.getItems()), e.updateCollection("resourceOptions", r);
    });
  }), e.getTaskBy = n.getTaskBy, e.getResourceAssignments = n.getResourceAssignments, e.config.resource_property = "owner_id", e.config.resource_store = "resource", e.config.resource_render_empty_cells = !1, e.templates.histogram_cell_class = function(s, i, o, l, r) {
  }, e.templates.histogram_cell_label = function(s, i, o, l, r) {
    return l.length + "/3";
  }, e.templates.histogram_cell_allocated = function(s, i, o, l, r) {
    return l.length / 3;
  }, e.templates.histogram_cell_capacity = function(s, i, o, l, r) {
    return 0;
  };
  const t = function(s, i, o, l, r) {
    return l.length <= 1 ? "gantt_resource_marker_ok" : "gantt_resource_marker_overtime";
  }, a = function(s, i, o, l, r) {
    return 8 * l.length;
  };
  e.templates.resource_cell_value = a, e.templates.resource_cell_class = t, e.attachEvent("onBeforeGanttReady", function() {
    e.config.resources && e.config.resources.editable_resource_diagram && (e.config.resource_render_empty_cells = !0, e.templates.resource_cell_value === a && (e.templates.resource_cell_value = e.ext.resources.editableResourceCellTemplate), e.templates.resource_cell_class === t && (e.templates.resource_cell_class = e.ext.resources.editableResourceCellClass), e.ext.resources.initEditableDiagram(e));
  });
}
function Xt(e) {
  var n = "$resourceAssignments";
  e.config.resource_assignment_store = "resourceAssignments", e.config.process_resource_assignments = !0;
  var t = "auto", a = "singleValue", s = "valueArray", i = "resourceValueArray", o = "assignmentsArray", l = t, r = "fixedDates", d = "fixedDuration", c = "default";
  function u(m, S) {
    m.start_date ? m.start_date = e.date.parseDate(m.start_date, "parse_date") : m.start_date = null, m.end_date ? m.end_date = e.date.parseDate(m.end_date, "parse_date") : m.end_date = null;
    var C = Number(m.delay), b = !1;
    if (isNaN(C) ? (m.delay = 0, b = !0) : m.delay = C, e.defined(m.value) || (m.value = null), !m.task_id || !m.resource_id) return !1;
    if (m.mode = m.mode || c, m.mode === d && (isNaN(Number(m.duration)) && (S = S || e.getTask(m.task_id), m.duration = e.calculateDuration({ start_date: m.start_date, end_date: m.end_date, id: S })), b && (S = S || e.getTask(m.task_id), m.delay = e.calculateDuration({ start_date: S.start_date, end_date: m.start_date, id: S }))), m.mode !== r && (S || e.isTaskExists(m.task_id))) {
      var T = h(m, S = S || e.getTask(m.task_id));
      m.start_date = T.start_date, m.end_date = T.end_date, m.duration = T.duration;
    }
  }
  var _ = e.createDatastore({ name: e.config.resource_assignment_store, initItem: function(m) {
    return m.id || (m.id = e.uid()), u(m), m;
  } });
  function h(m, S) {
    if (m.mode === r) return { start_date: m.start_date, end_date: m.end_date, duration: m.duration };
    var C, b, T = m.delay ? e.calculateEndDate({ start_date: S.start_date, duration: m.delay, task: S }) : new Date(S.start_date);
    return m.mode === d ? (C = e.calculateEndDate({ start_date: T, duration: m.duration, task: S }), b = m.duration) : (C = new Date(S.end_date), b = S.duration - m.delay), { start_date: T, end_date: C, duration: b };
  }
  function g(m) {
    const S = e.config.resource_property;
    let C = m[S];
    const b = [];
    let T = l === t;
    if (e.defined(C) && C) {
      Array.isArray(C) || (C = [C], T && (l = a, T = !1));
      const x = {};
      C.forEach(function(w) {
        w.resource_id || (w = { resource_id: w }, T && (l = s, T = !1)), T && (w.id && w.resource_id ? (l = o, T = !1) : (l = i, T = !1));
        let E, $ = c;
        w.mode || (w.start_date && w.end_date || w.start_date && w.duration) && ($ = d), E = w.id || !w.$id || x[w.$id] ? w.id && !x[w.id] ? w.id : e.uid() : w.$id, x[E] = !0;
        const A = { id: E, start_date: w.start_date, duration: w.duration, end_date: w.end_date, delay: w.delay, task_id: m.id, resource_id: w.resource_id, value: w.value, mode: w.mode || $ };
        Object.keys(w).forEach((D) => {
          D != "$id" && (A[D] = w[D]);
        }), A.start_date && A.start_date.getMonth && A.end_date && A.end_date.getMonth && typeof A.duration == "number" || u(A, m), b.push(A);
      });
    }
    return b;
  }
  function p(m) {
    if (e.isTaskExists(m)) {
      var S = e.getTask(m);
      k(S, e.getTaskAssignments(S.id));
    }
  }
  function k(m, S) {
    S.sort(function(C, b) {
      return C.start_date && b.start_date && C.start_date.valueOf() != b.start_date.valueOf() ? C.start_date - b.start_date : 0;
    }), l == o ? m[e.config.resource_property] = S : l == i && (m[e.config.resource_property] = S.map(function(C) {
      return { $id: C.id, start_date: C.start_date, duration: C.duration, end_date: C.end_date, delay: C.delay, resource_id: C.resource_id, value: C.value, mode: C.mode };
    })), m[n] = S;
  }
  function v(m) {
    var S = g(m);
    return S.forEach(function(C) {
      C.id = C.id || e.uid();
    }), S;
  }
  function f(m, S) {
    var C = function(b, T) {
      var x = { inBoth: [], inTaskNotInStore: [], inStoreNotInTask: [] };
      if (l == a) {
        var w = b[0], E = w ? w.resource_id : null, $ = !1;
        T.forEach(function(M) {
          M.resource_id != E ? x.inStoreNotInTask.push(M) : M.resource_id == E && (x.inBoth.push({ store: M, task: w }), $ = !0);
        }), !$ && w && x.inTaskNotInStore.push(w);
      } else if (l == s) {
        var A = {}, D = {}, L = {};
        b.forEach(function(M) {
          A[M.resource_id] = M;
        }), T.forEach(function(M) {
          D[M.resource_id] = M;
        }), b.concat(T).forEach(function(M) {
          if (!L[M.resource_id]) {
            L[M.resource_id] = !0;
            var I = A[M.resource_id], P = D[M.resource_id];
            I && P ? x.inBoth.push({ store: P, task: I }) : I && !P ? x.inTaskNotInStore.push(I) : !I && P && x.inStoreNotInTask.push(P);
          }
        });
      } else l != o && l != i || (A = {}, D = {}, L = {}, b.forEach(function(M) {
        A[M.id || M.$id] = M;
      }), T.forEach(function(M) {
        D[M.id] = M;
      }), b.concat(T).forEach(function(M) {
        var I = M.id || M.$id;
        if (!L[I]) {
          L[I] = !0;
          var P = A[I], F = D[I];
          P && F ? x.inBoth.push({ store: F, task: P }) : P && !F ? x.inTaskNotInStore.push(P) : !P && F && x.inStoreNotInTask.push(F);
        }
      }));
      return x;
    }(g(m), S);
    C.inStoreNotInTask.forEach(function(b) {
      _.removeItem(b.id);
    }), C.inTaskNotInStore.forEach(function(b) {
      _.addItem(b);
    }), C.inBoth.forEach(function(b) {
      if (function(x, w) {
        var E = { id: !0 };
        for (var $ in x) if (!E[$] && String(x[$]) !== String(w[$])) return !0;
        return !1;
      }(b.task, b.store)) (function(x, w) {
        var E = { id: !0 };
        for (var $ in x) E[$] || (w[$] = x[$]);
      })(b.task, b.store), _.updateItem(b.store.id);
      else if (b.task.start_date && b.task.end_date && b.task.mode !== r) {
        var T = h(b.store, m);
        b.store.start_date.valueOf() == T.start_date.valueOf() && b.store.end_date.valueOf() == T.end_date.valueOf() || (b.store.start_date = T.start_date, b.store.end_date = T.end_date, b.store.duration = T.duration, _.updateItem(b.store.id));
      }
    }), p(m.id);
  }
  function y(m) {
    var S = m[n] || _.find(function(C) {
      return C.task_id == m.id;
    });
    f(m, S);
  }
  e.$data.assignmentsStore = _, e.attachEvent("onGanttReady", function() {
    if (e.config.process_resource_assignments) {
      e.attachEvent("onParse", function() {
        e.silent(function() {
          _.clearAll();
          var E = [];
          e.eachTask(function($) {
            if ($.type !== e.config.types.project) {
              var A = v($);
              k($, A), A.forEach(function(D) {
                E.push(D);
              });
            }
          }), _.parse(E);
        });
      });
      var m = !1, S = !1, C = {}, b = !1;
      e.attachEvent("onBeforeBatchUpdate", function() {
        m = !0;
      }), e.attachEvent("onAfterBatchUpdate", function() {
        if (S) {
          var E = {};
          for (var $ in C) E[$] = e.getTaskAssignments(C[$].id);
          for (var $ in e.config.process_resource_assignments && l === "resourceValueArray" && (w = null), C) f(C[$], E[$]);
        }
        S = !1, m = !1, C = {};
      }), e.attachEvent("onTaskCreated", function(E) {
        var $ = v(E);
        return _.parse($), k(E, $), !0;
      }), e.attachEvent("onAfterTaskUpdate", function(E, $) {
        m ? (S = !0, C[E] = $) : $.unscheduled || y($);
      }), e.attachEvent("onAfterTaskAdd", function(E, $) {
        m ? (S = !0, C[E] = $) : y($);
      }), e.attachEvent("onRowDragEnd", function(E) {
        y(e.getTask(E));
      }), e.$data.tasksStore.attachEvent("onAfterDeleteConfirmed", function(E, $) {
        var A, D = [E];
        e.eachTask(function(L) {
          D.push(L.id);
        }, E), A = {}, D.forEach(function(L) {
          A[L] = !0;
        }), _.find(function(L) {
          return A[L.task_id];
        }).forEach(function(L) {
          _.removeItem(L.id);
        });
      }), e.$data.tasksStore.attachEvent("onClearAll", function() {
        return T = null, x = null, w = null, _.clearAll(), !0;
      }), e.attachEvent("onTaskIdChange", function(E, $) {
        _.find(function(A) {
          return A.task_id == E;
        }).forEach(function(A) {
          A.task_id = $, _.updateItem(A.id);
        }), p($);
      }), e.attachEvent("onBeforeUndo", function(E) {
        return b = !0, !0;
      }), e.attachEvent("onAfterUndo", function(E) {
        b = !0;
      });
      var T = null, x = null, w = null;
      _.attachEvent("onStoreUpdated", function() {
        return m && !b || (T = null, x = null, w = null), !0;
      }), e.getResourceAssignments = function(E, $) {
        var A = e.defined($) && $ !== null;
        return T === null && (T = {}, x = {}, _.eachItem(function(D) {
          T[D.resource_id] || (T[D.resource_id] = []), T[D.resource_id].push(D);
          var L = D.resource_id + "-" + D.task_id;
          x[L] || (x[L] = []), x[L].push(D);
        })), A ? (x[E + "-" + $] || []).slice() : (T[E] || []).slice();
      }, e.getTaskAssignments = function(E) {
        if (w === null) {
          var $ = [];
          w = {}, _.eachItem(function(A) {
            w[A.task_id] || (w[A.task_id] = []), w[A.task_id].push(A), A.task_id == E && $.push(A);
          });
        }
        return (w[E] || []).slice();
      }, e.getTaskResources = function(E) {
        const $ = e.getDatastore("resource"), A = e.getTaskAssignments(E), D = {};
        A.forEach(function(M) {
          D[M.resource_id] || (D[M.resource_id] = M.resource_id);
        });
        const L = [];
        for (const M in D) {
          const I = $.getItem(D[M]);
          I && L.push(I);
        }
        return L;
      }, e.updateTaskAssignments = p;
    }
  }, { once: !0 });
}
function Zt(e) {
  function n(l) {
    return function() {
      return !e.config.placeholder_task || l.apply(this, arguments);
    };
  }
  function t() {
    var l = e.getTaskBy("type", e.config.types.placeholder);
    if (!l.length || !e.isTaskExists(l[0].id)) {
      var r = { unscheduled: !0, type: e.config.types.placeholder, duration: 0, text: e.locale.labels.new_task };
      if (e.callEvent("onTaskCreated", [r]) === !1) return;
      e.addTask(r);
    }
  }
  function a(l) {
    var r = e.getTask(l);
    r.type == e.config.types.placeholder && (r.start_date && r.end_date && r.unscheduled && (r.unscheduled = !1), e.batchUpdate(function() {
      var d = e.copy(r);
      e.silent(function() {
        e.deleteTask(r.id);
      }), delete d["!nativeeditor_status"], d.type = e.config.types.task, d.id = e.uid(), e.addTask(d);
    }));
  }
  e.config.types.placeholder = "placeholder", e.attachEvent("onDataProcessorReady", n(function(l) {
    l && !l._silencedPlaceholder && (l._silencedPlaceholder = !0, l.attachEvent("onBeforeUpdate", n(function(r, d, c) {
      return c.type != e.config.types.placeholder || (l.setUpdated(r, !1), !1);
    })));
  }));
  var s = !1;
  function i(l) {
    return !!(e.config.types.placeholder && e.isTaskExists(l) && e.getTask(l).type == e.config.types.placeholder);
  }
  function o(l) {
    return !(!i(l.source) && !i(l.target));
  }
  e.attachEvent("onGanttReady", function() {
    s || (s = !0, e.attachEvent("onAfterTaskUpdate", n(a)), e.attachEvent("onAfterTaskAdd", n(function(l, r) {
      r.type != e.config.types.placeholder && (e.getTaskBy("type", e.config.types.placeholder).forEach(function(d) {
        e.silent(function() {
          e.isTaskExists(d.id) && e.deleteTask(d.id);
        });
      }), t());
    })), e.attachEvent("onParse", n(t)));
  }), e.attachEvent("onLinkValidation", function(l) {
    return !o(l);
  }), e.attachEvent("onBeforeLinkAdd", function(l, r) {
    return !o(r);
  }), e.attachEvent("onBeforeUndoStack", function(l) {
    for (var r = 0; r < l.commands.length; r++) {
      var d = l.commands[r];
      d.entity === "task" && d.value.type === e.config.types.placeholder && (l.commands.splice(r, 1), r--);
    }
    return !0;
  });
}
function Qt(e) {
  function n(c) {
    return function() {
      return !e.config.auto_types || e.getTaskType(e.config.types.project) != e.config.types.project || c.apply(this, arguments);
    };
  }
  function t(c, u) {
    var _ = e.getTask(c), h = i(_);
    h !== !1 && e.getTaskType(_) !== h && (u.$needsUpdate = !0, u[_.id] = { task: _, type: h });
  }
  function a(c) {
    if (!e.getState().group_mode) {
      var u = function(_, h) {
        return t(_, h = h || {}), e.eachParent(function(g) {
          t(g.id, h);
        }, _), h;
      }(c);
      u.$needsUpdate && e.batchUpdate(function() {
        (function(_) {
          for (var h in _) if (_[h] && _[h].task) {
            var g = _[h].task;
            g.type = _[h].type, e.updateTask(g.id);
          }
        })(u);
      });
    }
  }
  var s;
  function i(c) {
    var u = e.config.types, _ = e.hasChild(c.id), h = e.getTaskType(c.type);
    return _ && h === u.task ? u.project : !_ && h === u.project && u.task;
  }
  var o, l, r = !0;
  function d(c) {
    c != e.config.root_id && e.isTaskExists(c) && a(c);
  }
  e.attachEvent("onParse", n(function() {
    r = !1, e.getState().group_mode || (e.batchUpdate(function() {
      e.eachTask(function(c) {
        var u = i(c);
        u !== !1 && function(_, h) {
          e.getState().group_mode || (_.type = h, e.updateTask(_.id));
        }(c, u);
      });
    }), r = !0);
  })), e.attachEvent("onAfterTaskAdd", n(function(c) {
    r && a(c);
  })), e.attachEvent("onAfterTaskUpdate", n(function(c) {
    r && a(c);
  })), e.attachEvent("onBeforeTaskDelete", n(function(c, u) {
    return s = e.getParent(c), !0;
  })), e.attachEvent("onAfterTaskDelete", n(function(c, u) {
    d(s);
  })), e.attachEvent("onRowDragStart", n(function(c, u, _) {
    return o = e.getParent(c), !0;
  })), e.attachEvent("onRowDragEnd", n(function(c, u) {
    d(o), a(c);
  })), e.attachEvent("onBeforeTaskMove", n(function(c, u, _) {
    return l = e.getParent(c), !0;
  })), e.attachEvent("onAfterTaskMove", n(function(c, u, _) {
    document.querySelector(".gantt_drag_marker") || (d(l), a(c));
  }));
}
const he = class he {
  constructor(n = null) {
    this.canParse = (t) => {
      let a = "";
      const s = this._config.labels;
      for (const i in s) {
        const o = s[i];
        a += `${o.full}|${o.plural}|${o.short}|`;
      }
      return new RegExp(`^([+-]? *[0-9.]{1,}\\s*(${a})\\s*)*$`).test((t || "").trim());
    }, this.format = (t) => {
      const a = this._config.store, s = this._config.format, i = this._config.short;
      let o = this.transferUnits[a].toMinutes(t), l = s;
      if (l && l === "auto" && (l = this._selectFormatForValue(o)), l || (l = "day"), s === "auto" && !t) return "";
      l = Array.isArray(l) ? l : [l];
      let r = "";
      const d = l.length - 1;
      for (let c = 0; c < l.length; c++) {
        const u = l[c], _ = this._getValueFromMinutes(o, u, c === d);
        o -= this._getValueInMinutes(_, u), r += `${this._getLabelForConvert(_, u, i)}${c === d ? "" : " "}`;
      }
      return r;
    }, this.parse = (t) => {
      if (this.canParse(t)) {
        let a = "", s = !1, i = !1, o = 0;
        const l = (t = (t || "").trim()).length - 1, r = /^[+\-0-9\. ]$/;
        for (let d = 0; d < t.length; d++) {
          const c = t[d];
          r.test(c) ? i = s : s = !0, (i || l === d) && (i || (a += c), o += this._getNumericValue(a), s = i = !1, a = ""), a += c;
        }
        if (o) {
          const d = this._config.store;
          return Math.round(this.transferUnits[d].fromMinutes(Math.ceil(o)));
        }
      }
      return null;
    }, this._getValueInMinutes = (t, a) => this.transferUnits[a] && this.transferUnits[a].toMinutes ? this.transferUnits[a].toMinutes(t) : 0, this._getLabelForConvert = (t, a, s) => {
      const i = this._config.labels[a];
      return s ? `${t}${i.short}` : `${t} ${t !== 1 && t !== -1 ? i.plural : i.full}`;
    }, this._getValueFromMinutes = (t, a, s) => {
      if (this.transferUnits[a] && this.transferUnits[a].fromMinutes) {
        const i = this.transferUnits[a].fromMinutes(t);
        return s ? parseFloat(i.toFixed(2)) : parseInt(i.toString(), 10);
      }
      return null;
    }, this._isUnitName = (t, a) => (a = a.toLowerCase(), t.full.toLowerCase() === a || t.plural.toLowerCase() === a || t.short.toLowerCase() === a), this._getUnitName = (t) => {
      const a = this._config.labels;
      let s, i = !1;
      for (s in a) if (this._isUnitName(a[s], t)) {
        i = !0;
        break;
      }
      return i ? s : this._config.enter;
    }, this._config = this._defaultSettings(n), this.transferUnits = { minute: { toMinutes: (t) => t, fromMinutes: (t) => t }, hour: { toMinutes: (t) => t * this._config.minutesPerHour, fromMinutes: (t) => t / this._config.minutesPerHour }, day: { toMinutes: (t) => t * this._config.minutesPerHour * this._config.hoursPerDay, fromMinutes: (t) => t / (this._config.minutesPerHour * this._config.hoursPerDay) }, week: { toMinutes: (t) => t * this._config.minutesPerHour * this._config.hoursPerWeek, fromMinutes: (t) => t / (this._config.minutesPerHour * this._config.hoursPerWeek) }, month: { toMinutes: (t) => t * this._config.minutesPerHour * this._config.hoursPerDay * this._config.daysPerMonth, fromMinutes: (t) => t / (this._config.minutesPerHour * this._config.hoursPerDay * this._config.daysPerMonth) }, year: { toMinutes: (t) => t * this._config.minutesPerHour * this._config.hoursPerDay * this._config.daysPerYear, fromMinutes: (t) => t / (this._config.minutesPerHour * this._config.hoursPerDay * this._config.daysPerYear) } };
  }
  _defaultSettings(n = null) {
    const t = { enter: "day", store: "hour", format: "auto", short: !1, minutesPerHour: 60, hoursPerDay: 8, hoursPerWeek: 40, daysPerMonth: 30, daysPerYear: 365, labels: { minute: { full: "minute", plural: "minutes", short: "min" }, hour: { full: "hour", plural: "hours", short: "h" }, day: { full: "day", plural: "days", short: "d" }, week: { full: "week", plural: "weeks", short: "wk" }, month: { full: "month", plural: "months", short: "mon" }, year: { full: "year", plural: "years", short: "y" } } };
    if (n) {
      for (const a in n) n[a] !== void 0 && a !== "labels" && (t[a] = n[a]);
      if (n.labels) for (const a in n.labels) t.labels[a] = n.labels[a];
    }
    return t;
  }
  _selectFormatForValue(n) {
    const t = ["year", "month", "day", "hour", "minute"], a = [];
    for (let s = 0; s < t.length; s++) a[s] = Math.abs(this.transferUnits[t[s]].fromMinutes(n));
    for (let s = 0; s < a.length; s++)
      if (!(a[s] < 1 && s < a.length - 1)) return t[s];
    return "day";
  }
  _getNumericValue(n) {
    const t = parseFloat(n.replace(/ /g, "")) || 0, a = n.match(new RegExp("\\p{L}", "gu")) ? n.match(new RegExp("\\p{L}", "gu")).join("") : "", s = this._getUnitName(a);
    return t && s ? this._getValueInMinutes(t, s) : 0;
  }
};
he.create = (n = null) => new he(n);
let $e = he;
const ge = class ge {
  constructor(n) {
    this.format = (t) => this._getWBSCode(t.source), this.canParse = (t) => this._linkReg.test(t), this.parse = (t) => {
      if (!this.canParse(t)) return null;
      const a = this._linkReg.exec(t)[0].trim();
      return { id: void 0, source: this._findSource(a) || null, target: null, type: this._gantt.config.links.finish_to_start, lag: 0 };
    }, this._getWBSCode = (t) => {
      const a = this._gantt.getTask(t);
      return this._gantt.getWBSCode(a);
    }, this._findSource = (t) => {
      const a = new RegExp("^[0-9.]+", "i");
      if (a.exec(t)) {
        const s = a.exec(t)[0], i = this._gantt.getTaskByWBSCode(s);
        if (i) return i.id;
      }
      return null;
    }, this._linkReg = /^[0-9\.]+/, this._gantt = n;
  }
};
ge.create = (n = null, t) => new ge(t);
let Ae = ge;
const fe = class fe extends Ae {
  constructor(n, t) {
    super(t), this.format = (a) => {
      const s = this._getFormattedLinkType(this._getLinkTypeName(a.type)), i = this._getWBSCode(a.source), o = this._getLagString(a.lag);
      return a.type !== this._gantt.config.links.finish_to_start || a.lag ? `${i}${s}${o}` : i;
    }, this.parse = (a) => {
      if (!this.canParse(a)) return null;
      const s = this._linkReg.exec(a)[0].trim(), i = a.replace(s, "").trim(), o = this._findTypeFormat(s), l = this._getLinkTypeNumber(o);
      return { id: void 0, source: this._findSource(s) || null, target: null, type: l, lag: this._parseLag(i) };
    }, this._getLinkTypeName = (a) => {
      let s = "";
      for (s in this._config.labels) if (String(this._gantt.config.links[s]).toLowerCase() === String(a).toLowerCase()) break;
      return s;
    }, this._getLinkTypeNumber = (a) => {
      let s = "";
      for (s in this._gantt.config.links) if (s.toLowerCase() === a.toLowerCase()) break;
      return this._gantt.config.links[s];
    }, this._getFormattedLinkType = (a) => this._config.labels[a] || "", this._getLagString = (a) => {
      if (!a) return "";
      const s = this._config.durationFormatter.format(a);
      return a < 0 ? s : `+${s}`;
    }, this._findTypeFormat = (a) => {
      const s = a.replace(/[^a-zA-Z]/gi, "");
      let i = "finish_to_start";
      for (const o in this._config.labels) this._config.labels[o].toLowerCase() === s.toLowerCase() && (i = o);
      return i;
    }, this._parseLag = (a) => a ? this._config.durationFormatter.parse(a) : 0, this._config = this._defaultSettings(n), this._linkReg = /^[0-9\.]+[a-zA-Z]*/;
  }
  _defaultSettings(n = null) {
    const t = { durationFormatter: this._gantt.ext.formatters.durationFormatter(), labels: { finish_to_finish: "FF", finish_to_start: "FS", start_to_start: "SS", start_to_finish: "SF" } };
    if (n && n.durationFormatter && (t.durationFormatter = n.durationFormatter), n && n.labels) for (const a in n.labels) t.labels[a] = n.labels[a];
    return t;
  }
};
fe.create = (n = null, t) => new fe(n, t);
let De = fe;
function en(e) {
  e.ext.formatters = { durationFormatter: function(n) {
    return n || (n = {}), n.store || (n.store = e.config.duration_unit), n.enter || (n.enter = e.config.duration_unit), $e.create(n, e);
  }, linkFormatter: function(n) {
    return De.create(n, e);
  } };
}
function tn(e) {
  e.ext = e.ext || {}, e.config.show_empty_state = !1, e.ext.emptyStateElement = e.ext.emptyStateElement || { isEnabled: () => e.config.show_empty_state === !0, isGanttEmpty: () => !e.getTaskByTime().length, renderContent(n) {
    const t = `<div class='gantt_empty_state'><div class='gantt_empty_state_image'></div>${`<div class='gantt_empty_state_text'>
    <div class='gantt_empty_state_text_link' data-empty-state-create-task>${e.locale.labels.empty_state_text_link}</div>
    <div class='gantt_empty_state_text_description'>${e.locale.labels.empty_state_text_description}</div>
    </div>`}</div>`;
    n.innerHTML = t;
  }, clickEvents: [], attachAddTaskEvent() {
    const n = e.attachEvent("onEmptyClick", function(t) {
      e.utils.dom.closest(t.target, "[data-empty-state-create-task]") && e.createTask({ id: e.uid(), text: "New Task" });
    });
    this.clickEvents.push(n);
  }, detachAddTaskEvents() {
    this.clickEvents.forEach(function(n) {
      e.detachEvent(n);
    }), this.clickEvents = [];
  }, getContainer() {
    if (e.$container) {
      const n = e.utils.dom;
      if (e.$container.contains(e.$grid_data)) return n.closest(e.$grid_data, ".gantt_layout_content");
      if (e.$container.contains(e.$task_data)) return n.closest(e.$task_data, ".gantt_layout_content");
    }
    return null;
  }, getNode() {
    const n = this.getContainer();
    return n ? n.querySelector(".gantt_empty_state_wrapper") : null;
  }, show() {
    const n = this.getContainer();
    if (!n && this.isGanttEmpty()) return null;
    const t = document.createElement("div");
    t.className = "gantt_empty_state_wrapper", t.style.marginTop = e.config.scale_height - n.offsetHeight + "px";
    const a = e.$container.querySelectorAll(".gantt_empty_state_wrapper");
    Array.prototype.forEach.call(a, function(s) {
      s.parentNode.removeChild(s);
    }), this.detachAddTaskEvents(), this.attachAddTaskEvent(), n.appendChild(t), this.renderContent(t);
  }, hide() {
    const n = this.getNode();
    if (!n) return !1;
    n.parentNode.removeChild(n);
  }, init() {
  } }, e.attachEvent("onDataRender", function() {
    const n = e.ext.emptyStateElement;
    n.isEnabled() && n.isGanttEmpty() ? n.show() : n.hide();
  });
}
const nn = function(e, n) {
  const t = n.baselines && n.baselines.length, a = e.config.baselines.render_mode == "separateRow" || e.config.baselines.render_mode == "individualRow";
  if (t && a) return !0;
}, ne = function(e) {
  return e.render && e.render == "split" && !e.$open;
};
function an(e) {
  e.config.baselines = { datastore: "baselines", render_mode: !1, dataprocessor_baselines: !1, row_height: 16, bar_height: 8 };
  const n = e.createDatastore({ name: e.config.baselines.datastore, initItem: function(s) {
    return s.id || (s.id = e.uid()), function(i) {
      if (!i.task_id || !i.start_date && !i.end_date) return !1;
      i.start_date ? i.start_date = e.date.parseDate(i.start_date, "parse_date") : i.start_date = null, i.end_date ? i.end_date = e.date.parseDate(i.end_date, "parse_date") : i.end_date = null, i.duration = i.duration || 1, i.start_date && !i.end_date ? i.end_date = e.calculateEndDate(i.start_date, i.duration) : i.end_date && !i.start_date && (i.start_date = e.calculateEndDate(i.end_date, -i.duration));
    }(s), s;
  } });
  function t(s) {
    let i = 0;
    e.adjustTaskHeightForBaselines(s), e.eachTask(function(o) {
      let l = o.row_height || e.config.row_height;
      i = i || l, l > i && (i = l);
    }, s.id), s.row_height < i && (s.row_height = i);
  }
  function a(s) {
    e.eachParent(function(i) {
      if (ne(i)) {
        const o = i.row_height || e.getLayoutView("timeline").getBarHeight(i.id);
        let l = s.row_height;
        e.getChildren(i.id).forEach(function(r) {
          const d = e.getTask(r);
          if (d.id == s.id) return;
          const c = d.row_height || e.getLayoutView("timeline").getBarHeight(d.id);
          l = l || c, c > l && (l = c);
        }), i.row_height = l, i.bar_height = i.bar_height || o;
      }
    }, s.id);
  }
  e.$data.baselineStore = n, e.adjustTaskHeightForBaselines = function(s) {
    let i, o, l = s.baselines && s.baselines.length || 0;
    const r = e.config.baselines.row_height, d = e.getLayoutView("timeline");
    if (d && e.config.show_chart) switch (e.config.baselines.render_mode) {
      case "taskRow":
      default:
        s.row_height = s.bar_height + 8;
        break;
      case "separateRow":
        i = d.getBarHeight(s.id), l ? (s.bar_height = s.bar_height || i, s.bar_height > i && (i = s.bar_height), s.row_height = i + r) : s.bar_height && (s.row_height = s.bar_height + 4), a(s);
        break;
      case "individualRow":
        i = d.getBarHeight(s.id), l ? (s.bar_height = s.bar_height || i, s.bar_height > i && (i = s.bar_height), o = r * l, s.row_height = i + o + 2) : s.bar_height && (s.row_height = s.bar_height + 4), a(s);
    }
  }, e.attachEvent("onGanttReady", function() {
    e.config.baselines && (e.attachEvent("onParse", function() {
      n.eachItem(function(s) {
        const i = s.task_id;
        if (e.isTaskExists(i)) {
          const o = e.getTask(i);
          o.baselines = o.baselines || [];
          let l = !0;
          for (let r = 0; r < o.baselines.length; r++) {
            let d = o.baselines[r];
            if (d.id == s.id) {
              l = !1, e.mixin(d, s, !0);
              break;
            }
          }
          l && o.baselines.push(s), H(e) || (ne(o) ? t(o) : e.adjustTaskHeightForBaselines(o));
        }
      });
    }), e.attachEvent("onBeforeTaskUpdate", function(s, i) {
      return function(o) {
        let l = !1;
        const r = {}, d = o.baselines || [], c = e.getTaskBaselines(o.id);
        d.length != c.length && (l = !0), d.forEach(function(u) {
          r[u.id] = !0;
          const _ = n.getItem(u.id);
          if (_) {
            const h = +_.start_date != +u.start_date, g = +_.end_date != +u.end_date;
            (h || g) && n.updateItem(u.id, u);
          } else n.addItem(u);
        }), c.forEach(function(u) {
          r[u.id] || n.removeItem(u.id);
        }), l && (ne(o) ? t(o) : e.adjustTaskHeightForBaselines(o), e.render());
      }(i), !0;
    }), e.attachEvent("onAfterUndo", function(s) {
      if ((e.config.baselines.render_mode == "separateRow" || e.config.baselines.render_mode == "individualRow") && s) {
        let i = !1;
        s.commands.forEach(function(o) {
          if (o.entity == "task") {
            const l = o.value.id;
            if (e.isTaskExists(l)) {
              const r = e.getTask(l);
              if (r.parent && e.isTaskExists(r.parent)) {
                const d = e.getTask(r.parent);
                ne(d) && (t(d), i = !0);
              }
            }
          }
        }), i && e.render();
      }
    }), e.attachEvent("onAfterTaskDelete", function(s, i) {
      if (nn && i.parent && e.isTaskExists(i.parent)) {
        const o = e.getTask(i.parent);
        ne(o) && t(o);
      }
      n.eachItem(function(o) {
        e.isTaskExists(o.task_id) || n.removeItem(o.id);
      });
    }), e.getTaskBaselines = function(s) {
      const i = [];
      return n.eachItem(function(o) {
        o.task_id == s && i.push(o);
      }), i;
    }, e.$data.baselineStore.attachEvent("onClearAll", function() {
      return e.eachTask(function(s) {
        s.baselines && delete s.baselines;
      }), !0;
    }), e.$data.tasksStore.attachEvent("onClearAll", function() {
      return n.clearAll(), !0;
    }), e.attachEvent("onTaskIdChange", function(s, i) {
      n.find(function(o) {
        return o.task_id == s;
      }).forEach(function(o) {
        o.task_id = i, n.updateItem(o.id);
      });
    }));
  }, { once: !0 });
}
class sn {
  constructor(n, t) {
    const a = new it({ url: n, token: t });
    a.fetch = function(s, i) {
      const o = { headers: this.headers() };
      return i && (o.method = "POST", o.body = i), fetch(s, o).then((l) => l.json());
    }, this._ready = a.load().then((s) => this._remote = s);
  }
  ready() {
    return this._ready;
  }
  on(n, t) {
    this.ready().then((a) => {
      if (typeof n == "string") a.on(n, t);
      else for (const s in n) a.on(s, n[s]);
    });
  }
}
function rn(e) {
  let n = [], t = null;
  function a(l) {
    var u, _;
    if (!l || !l.type || !((u = l.task) != null && u.id) && !((_ = l.link) != null && _.id)) return void console.error("Invalid message format:", l);
    const { type: r, task: d, link: c } = l;
    if (!(d && e._dp._in_progress[d.id] || c && e._dp._in_progress[c.id])) {
      if (r === "add-task") {
        for (const h in e._dp._in_progress) if (e._dp.getState(h) === "inserted") return void e._dp.attachEvent("onFullSync", function() {
          e.isTaskExists(d.id) || i(l);
        }, { once: !0 });
      }
      n.push(l), t && clearTimeout(t), t = setTimeout(s, 50);
    }
  }
  function s() {
    n.length !== 0 && (n.length === 1 ? i(n[0]) : e.batchUpdate(function() {
      n.forEach((l) => {
        i(l);
      });
    }), n = []);
  }
  function i(l) {
    const { type: r, task: d, link: c } = l;
    switch (r) {
      case "add-task":
        (function(u) {
          if (e.isTaskExists(u.id)) return void console.warn(`Task with ID ${u.id} already exists. Skipping add.`);
          u.start_date = e.templates.parse_date(u.start_date), u.end_date && (u.end_date = e.templates.parse_date(u.end_date)), o(() => {
            e.addTask(u);
          });
        })(d);
        break;
      case "update-task":
        (function(u) {
          const _ = u.id;
          if (!e.getTask(_)) return void console.warn(`Task with ID ${_} does not exist. Skipping update.`);
          const h = e.getDatastore("task").$initItem.bind(e.getDatastore("task")), g = e.getTask(_);
          o(() => {
            const p = h(u);
            for (let k in p) g[k] = p[k];
            p.end_date || (g.end_date = e.calculateEndDate(g)), e.updateTask(_), _ !== u.id && e.changeTaskId(_, u.id);
          });
        })(d);
        break;
      case "delete-task":
        (function(u) {
          const _ = u.id;
          e.isTaskExists(_) && o(() => {
            e.getTask(_) && (e.getState().lightbox_id == _ && (u.id = this._lightbox_id, e.getTask(this._lightbox_id)), e.deleteTask(_, !0));
          });
        })(d);
        break;
      case "add-link":
        (function(u) {
          if (e.isLinkExists(u.id)) return void console.warn(`Link with ID ${u.id} already exists. Skipping add.`);
          o(() => {
            e.addLink(u);
          });
        })(c);
        break;
      case "update-link":
        (function(u) {
          const _ = u.id;
          if (!e.isLinkExists(_)) return void console.warn(`Link with ID ${_} does not exist. Skipping update.`);
          const h = e.getLink(_);
          o(() => {
            Object.assign(h, u), e.updateLink(_), _ !== u.id && e.changeLinkId(_, u.id);
          });
        })(c);
        break;
      case "delete-link":
        (function(u) {
          const _ = u.id;
          e.getLink(_) && o(() => {
            e.getLink(_) && (e.getState().lightbox_id == _ && (u.id = this._lightbox_id, e.getLink(this._lightbox_id)), e.deleteLink(_, !0));
          });
        })(c);
    }
  }
  function o(l) {
    e._dp ? e._dp.ignore(l) : l();
  }
  return { tasks: a, links: a };
}
function on(e) {
  e.ext || (e.ext = {}), e.ext.liveUpdates = { RemoteEvents: sn, remoteUpdates: rn(e) };
}
function ln(e) {
  var n = {}, t = {}, a = null, s = -1, i = null, o = /* @__PURE__ */ function(l) {
    var r = -1, d = -1;
    return { resetCache: function() {
      r = -1, d = -1;
    }, _getRowHeight: function() {
      return r === -1 && (r = l.$getConfig().row_height), r;
    }, _refreshState: function() {
      this.resetCache(), d = !0;
      var c = l.$config.rowStore;
      if (c) for (var u = this._getRowHeight(), _ = 0; _ < c.fullOrder.length; _++) {
        var h = c.getItem(c.fullOrder[_]);
        if (h && h.row_height && h.row_height !== u) {
          d = !1;
          break;
        }
      }
    }, canUseSimpleCalculation: function() {
      return d === -1 && this._refreshState(), d;
    }, getRowTop: function(c) {
      return l.$config.rowStore ? c * this._getRowHeight() : 0;
    }, getItemHeight: function(c) {
      return this._getRowHeight();
    }, getTotalHeight: function() {
      return l.$config.rowStore ? l.$config.rowStore.countVisible() * this._getRowHeight() : 0;
    }, getItemIndexByTopPosition: function(c) {
      return l.$config.rowStore ? Math.floor(c / this._getRowHeight()) : 0;
    } };
  }(e);
  return { _resetTopPositionHeight: function() {
    n = {}, t = {}, o.resetCache();
  }, _resetHeight: function() {
    var l = this.$config.rowStore, r = this.getCacheStateTotalHeight(l);
    i ? this.shouldClearHeightCache(i, r) && (i = r, a = null) : i = r, s = -1, o.resetCache();
  }, getRowTop: function(l) {
    if (o.canUseSimpleCalculation()) return o.getRowTop(l);
    var r = this.$config.rowStore;
    if (!r) return 0;
    if (t[l] !== void 0) return t[l];
    for (var d = r.getIndexRange(), c = 0, u = 0, _ = 0; _ < d.length; _++) t[_] = c, c += this.getItemHeight(d[_].id), _ < l && (u = c);
    return u;
  }, getItemTop: function(l) {
    if (this.$config.rowStore) {
      if (n[l] !== void 0) return n[l];
      var r = this.$config.rowStore;
      if (!r) return 0;
      var d = r.getIndexById(l);
      if (d === -1 && r.getParent && r.exists(l)) {
        var c = r.getParent(l);
        if (r.exists(c)) {
          var u = r.getItem(c);
          if (this.$gantt.isSplitTask(u)) return this.getItemTop(c);
        }
      }
      return n[l] = this.getRowTop(d), n[l];
    }
    return 0;
  }, getItemHeight: function(l) {
    if (o.canUseSimpleCalculation()) return o.getItemHeight(l);
    if (!a && this.$config.rowStore && this._fillHeightCache(this.$config.rowStore), a[l] !== void 0) return a[l];
    var r = this.$getConfig().row_height;
    if (this.$config.rowStore) {
      var d = this.$config.rowStore;
      if (!d) return r;
      var c = d.getItem(l);
      return a[l] = c && c.row_height || r;
    }
    return r;
  }, _fillHeightCache: function(l) {
    if (l) {
      a = {};
      var r = this.$getConfig().row_height;
      l.eachItem(function(d) {
        return a[d.id] = d && d.row_height || r;
      });
    }
  }, getCacheStateTotalHeight: function(l) {
    var r = this.$getConfig().row_height, d = {}, c = [], u = 0;
    return l && l.eachItem(function(_) {
      c.push(_), d[_.id] = _.row_height, u += _.row_height || r;
    }), { globalHeight: r, items: c, count: c.length, sumHeight: u };
  }, shouldClearHeightCache: function(l, r) {
    if (l.count != r.count || l.globalHeight != r.globalHeight || l.sumHeight != r.sumHeight) return !0;
    for (var d in l.items) {
      var c = r.items[d];
      if (c !== void 0 && c != l.items[d]) return !0;
    }
    return !1;
  }, getTotalHeight: function() {
    if (o.canUseSimpleCalculation()) return o.getTotalHeight();
    if (s != -1) return s;
    if (this.$config.rowStore) {
      var l = this.$config.rowStore;
      this._fillHeightCache(l);
      var r = this.getItemHeight.bind(this), d = l.getVisibleItems(), c = 0;
      return d.forEach(function(u) {
        c += r(u.id);
      }), s = c, c;
    }
    return 0;
  }, getItemIndexByTopPosition: function(l) {
    if (this.$config.rowStore) {
      if (o.canUseSimpleCalculation()) return o.getItemIndexByTopPosition(l);
      for (var r = this.$config.rowStore, d = 0; d < r.countVisible(); d++) {
        var c = this.getRowTop(d), u = this.getRowTop(d + 1);
        if (!u) {
          var _ = r.getIdByIndex(d);
          u = c + this.getItemHeight(_);
        }
        if (l >= c && l < u) return d;
      }
      return r.countVisible() + 2;
    }
    return 0;
  } };
}
class dn {
  constructor(n) {
    this._scrollOrder = 0;
    const { gantt: t, grid: a, dnd: s, getCurrentX: i } = n;
    this.$gantt = t, this.$grid = a, this._dnd = s, this.getCurrentX = i, this._scrollView = this.$gantt.$ui.getView(this.$grid.$config.scrollX), this.attachEvents();
  }
  attachEvents() {
    this.isScrollable() && (this._dnd.attachEvent("onDragMove", (n, t) => {
      const a = this.$grid.$grid.getBoundingClientRect(), s = a.right, i = a.left, o = this.getCurrentX(t.clientX);
      return o >= s - 20 && (this.autoscrollRight(), this.autoscrollStart()), o <= i + 20 && (this.autoscrollLeft(), this.autoscrollStart()), o < s - 20 && o > i + 20 && this.autoscrollStop(), !0;
    }), this._dnd.attachEvent("onDragEnd", () => {
      this.autoscrollStop();
    }));
  }
  autoscrollStart() {
    if (this._scrollOrder === 0) return;
    const n = 10 * this._scrollOrder, t = this._scrollView.getScrollState();
    this._scrollView.scrollTo(t.position + n), setTimeout(() => {
      this.autoscrollStart();
    }, 50);
  }
  autoscrollRight() {
    this._scrollOrder = 1;
  }
  autoscrollLeft() {
    this._scrollOrder = -1;
  }
  autoscrollStop() {
    this._scrollOrder = 0;
  }
  getCorrection() {
    return this.isScrollable() ? this._scrollView.getScrollState().position : 0;
  }
  isScrollable() {
    return !!this.$grid.$config.scrollable;
  }
}
const Ze = "data-column-id";
class cn {
  constructor(n, t) {
    this._targetMarker = null, this.calculateCurrentPosition = (a) => {
      const s = this.$grid.$grid.getBoundingClientRect(), i = s.right, o = s.left;
      let l = a;
      return l > i && (l = i), l < o && (l = o), l;
    }, this.$gantt = n, this.$grid = t;
  }
  init() {
    const n = this.$gantt.$services.getService("dnd");
    this._dnd = new n(this.$grid.$grid_scale, { updates_per_second: 60 }), this._scrollableGrid = new dn({ gantt: this.$gantt, grid: this.$grid, dnd: this._dnd, getCurrentX: this.calculateCurrentPosition }), this.attachEvents();
  }
  attachEvents() {
    this._dnd.attachEvent("onBeforeDragStart", (n, t) => {
      if (this._draggedCell = this.$gantt.utils.dom.closest(t.target, ".gantt_grid_head_cell"), !this._draggedCell) return;
      const a = this.$grid.$getConfig().columns, s = this._draggedCell.getAttribute(Ze);
      let i, o;
      return a.map(function(l, r) {
        l.name === s && (i = l, o = r);
      }), this.$grid.callEvent("onBeforeColumnDragStart", [{ draggedColumn: i, draggedIndex: o }]) !== !1 && !(!this._draggedCell || !i) && (this._gridConfig = this.$grid.$getConfig(), this._originAutoscroll = this.$gantt.config.autoscroll, this.$gantt.config.autoscroll = !1, !0);
    }), this._dnd.attachEvent("onAfterDragStart", (n, t) => {
      this._draggedCell && (this._dnd.config.column = this._draggedCell.getAttribute(Ze), this._dnd.config.marker.innerHTML = this._draggedCell.outerHTML, this._dnd.config.marker.classList.add("gantt_column_drag_marker"), this._dnd.config.marker.style.height = this._gridConfig.scale_height + "px", this._dnd.config.marker.style.lineHeight = this._gridConfig.scale_height + "px", this._draggedCell.classList.add("gantt_grid_head_cell_dragged"));
    }), this._dnd.attachEvent("onDragMove", (n, t) => {
      if (!this._draggedCell) return;
      this._dragX = t.clientX;
      const a = this.calculateCurrentPosition(t.clientX), s = this.findColumnsIndexes();
      return this.setMarkerPosition(a), this.drawTargetMarker(s), !0;
    }), this._dnd.attachEvent("onDragEnd", () => {
      if (!this._draggedCell) return;
      const n = this.findColumnsIndexes(), t = n.targetIndex, a = n.draggedIndex, s = this.$grid.$getConfig().columns, i = s[a], o = s[t];
      if (this.$grid.callEvent("onColumnDragMove", [{ draggedColumn: i, targetColumn: o, draggedIndex: a, targetIndex: t }]) === !1) return this.cleanTargetMarker(), void this.$gantt.render();
      this.$gantt.config.autoscroll = this._originAutoscroll, this._draggedCell.classList.remove("gantt_grid_head_cell_dragged"), this.cleanTargetMarker(), this.reorderColumns();
    });
  }
  reorderColumns() {
    const { targetIndex: n, draggedIndex: t } = this.findColumnsIndexes(), a = this.$grid.$getConfig().columns, s = a[t], i = a[n];
    this.$grid.callEvent("onBeforeColumnReorder", [{ draggedColumn: s, targetColumn: i, draggedIndex: t, targetIndex: n }]) !== !1 && n !== t && (a.splice(t, 1), a.splice(n, 0, s), this.$gantt.render(), this.$grid.callEvent("onAfterColumnReorder", [{ draggedColumn: s, targetColumn: i, draggedIndex: t, targetIndex: n }]));
  }
  findColumnsIndexes() {
    const n = this._dnd.config.column, t = this.$grid.$getConfig().columns;
    let a, s, i, o;
    const l = { startX: 0, endX: 0 };
    let r, d = 0, c = t.length - 1, u = (g, p) => g <= p, _ = (g) => ++g;
    this.$gantt.config.rtl && (d = t.length - 1, c = 0, u = (g, p) => g >= p, _ = (g) => --g);
    const h = this._dragX - this.$grid.$grid.getBoundingClientRect().left + this._scrollableGrid.getCorrection();
    for (let g = d; u(g, c) && (a === void 0 || s === void 0); g = _(g)) t[g].hide || (l.startX = l.endX, l.endX += t[g].width, h >= l.startX && (h <= l.endX || !u(_(g), c)) && (a = g, i = l.startX, o = l.endX, r = (h - l.startX) / (l.endX - l.startX)), n === t[g].name && (s = g));
    return { targetIndex: a, draggedIndex: s, xBefore: i, xAfter: o, columnRelativePos: r };
  }
  setMarkerPosition(n, t = 10) {
    const { marker: a } = this._dnd.config, s = this._dnd._obj.getBoundingClientRect();
    a.style.top = `${s.y + t}px`, a.style.left = `${n}px`;
  }
  drawTargetMarker({ targetIndex: n, draggedIndex: t, xBefore: a, xAfter: s, columnRelativePos: i }) {
    var o, l;
    let r;
    this._targetMarker || (this._targetMarker = document.createElement("div"), o = this._targetMarker, l = "gantt_grid_target_marker", o.className.indexOf(l) === -1 && (o.className += " " + l), this._targetMarker.style.display = "none", this._targetMarker.style.height = `${this._gridConfig.scale_height}px`), this._targetMarker.parentNode || this.$grid.$grid_scale.appendChild(this._targetMarker), r = n > t ? s : n < t ? a : i > 0.5 ? s : a, this._targetMarker.style.left = `${r}px`, this._targetMarker.style.display = "block";
  }
  cleanTargetMarker() {
    this._targetMarker && this._targetMarker.parentNode && this.$grid.$grid_scale.removeChild(this._targetMarker), this._targetMarker = null;
  }
}
var ct = function(e, n, t, a) {
  this.$config = B({}, n || {}), this.$gantt = a, this.$parent = e, ie(this), this.$state = {}, B(this, ln(this));
};
function un(e) {
  function n(t) {
    throw e.assert(!1, "Can't parse data: incorrect value of gantt.parse or gantt.load method. Actual argument value: " + JSON.stringify(t)), new Error("Invalid argument for gantt.parse or gantt.load. An object or a JSON string of format https://docs.dhtmlx.com/gantt/desktop__supported_data_formats.html#json is expected. Actual argument value: " + JSON.stringify(t));
  }
  e.load = function() {
    throw new Error("gantt.load() method is not available in the node.js, use gantt.parse() instead");
  }, e.parse = function(t, a) {
    this.on_load({ xmlDoc: { responseText: t } }, a);
  }, e.serialize = function(t) {
    return this[t = t || "json"].serialize();
  }, e.on_load = function(t, a) {
    if (t.xmlDoc && t.xmlDoc.status === 404) this.assert(!1, "Failed to load the data from <a href='" + t.xmlDoc.responseURL + "' target='_blank'>" + t.xmlDoc.responseURL + "</a>, server returns 404");
    else if (!e.$destroyed) {
      this.callEvent("onBeforeParse", []), a || (a = "json"), this.assert(this[a], "Invalid data type:'" + a + "'");
      var s = t.xmlDoc.responseText, i = this[a].parse(s, t);
      this._process_loading(i);
    }
  }, e._process_loading = function(t) {
    t.collections && this._load_collections(t.collections), t.resources && this.$data.resourcesStore && this.$data.resourcesStore.parse(t.resources), e.config.baselines && t.baselines && this.$data.baselineStore && this.$data.baselineStore.parse(t.baselines);
    const a = t.data || t.tasks;
    t.assignments && function(i, o) {
      const l = {};
      o.forEach((r) => {
        l[r.task_id] || (l[r.task_id] = []), l[r.task_id].push(r);
      }), i.forEach((r) => {
        r[e.config.resource_property] = l[r.id] || [];
      });
    }(a && a.length ? a : e.getTasksByTime(), t.assignments), a && this.$data.tasksStore.parse(a);
    var s = t.links || (t.collections && t.collections.links ? t.collections.links : []);
    this.$data.linksStore.parse(s), this.callEvent("onParse", []), this.render();
  }, e._load_collections = function(t) {
    var a = !1;
    for (var s in t) if (t.hasOwnProperty(s)) {
      a = !0;
      var i = t[s];
      this.serverList[s] = this.serverList[s] || [];
      var o = this.serverList[s];
      if (!o) continue;
      o.splice(0, o.length);
      for (var l = 0; l < i.length; l++) {
        var r = i[l], d = this.copy(r);
        for (var c in d.key = d.value, r) if (r.hasOwnProperty(c)) {
          if (c == "value" || c == "label") continue;
          d[c] = r[c];
        }
        o.push(d);
      }
    }
    a && this.callEvent("onOptionsLoad", []);
  }, e.attachEvent("onBeforeTaskDisplay", function(t, a) {
    return !a.$ignore;
  }), e.json = { parse: function(t) {
    if (t || n(t), typeof t == "string") if (typeof JSON != null) try {
      t = JSON.parse(t);
    } catch {
      n(t);
    }
    else e.assert(!1, "JSON is not supported");
    return t.dhx_security && (e.security_key = t.dhx_security), t;
  }, serializeTask: function(t) {
    return this._copyObject(t);
  }, serializeLink: function(t) {
    return this._copyLink(t);
  }, _copyLink: function(t) {
    var a = {};
    for (var s in t) a[s] = t[s];
    return a;
  }, _copyObject: function(t) {
    var a = {};
    for (var s in t) s.charAt(0) != "$" && (a[s] = t[s], G(a[s]) && (a[s] = e.defined(e.templates.xml_format) ? e.templates.xml_format(a[s]) : e.templates.format_date(a[s])));
    return a;
  }, serialize: function() {
    var t = [], a = [];
    let s = [];
    e.eachTask(function(l) {
      e.resetProjectDates(l), t.push(this.serializeTask(l));
    }, e.config.root_id, this);
    for (var i = e.getLinks(), o = 0; o < i.length; o++) a.push(this.serializeLink(i[o]));
    return e.getDatastore("baselines").eachItem(function(l) {
      const r = e.json.serializeTask(l);
      s.push(r);
    }), { data: t, links: a, baselines: s };
  } }, e.xml = { _xmlNodeToJSON: function(t, a) {
    for (var s = {}, i = 0; i < t.attributes.length; i++) s[t.attributes[i].name] = t.attributes[i].value;
    if (!a) {
      for (i = 0; i < t.childNodes.length; i++) {
        var o = t.childNodes[i];
        o.nodeType == 1 && (s[o.tagName] = o.firstChild ? o.firstChild.nodeValue : "");
      }
      s.text || (s.text = t.firstChild ? t.firstChild.nodeValue : "");
    }
    return s;
  }, _getCollections: function(t) {
    for (var a = {}, s = e.ajax.xpath("//coll_options", t), i = 0; i < s.length; i++) for (var o = a[s[i].getAttribute("for")] = [], l = e.ajax.xpath(".//item", s[i]), r = 0; r < l.length; r++) {
      for (var d = l[r].attributes, c = { key: l[r].getAttribute("value"), label: l[r].getAttribute("label") }, u = 0; u < d.length; u++) {
        var _ = d[u];
        _.nodeName != "value" && _.nodeName != "label" && (c[_.nodeName] = _.nodeValue);
      }
      o.push(c);
    }
    return a;
  }, _getXML: function(t, a, s) {
    s = s || "data", a.getXMLTopNode || (a = e.ajax.parse(a));
    var i = e.ajax.xmltop(s, a.xmlDoc);
    i && i.tagName == s || function(l) {
      throw e.assert(!1, "Can't parse data: incorrect value of gantt.parse or gantt.load method. Actual argument value: " + JSON.stringify(l)), new Error("Invalid argument for gantt.parse or gantt.load. An XML of format https://docs.dhtmlx.com/gantt/desktop__supported_data_formats.html#xmldhtmlxgantt20 is expected. Actual argument value: " + JSON.stringify(l));
    }(t);
    var o = i.getAttribute("dhx_security");
    return o && (e.security_key = o), i;
  }, parse: function(t, a) {
    a = this._getXML(t, a);
    for (var s = {}, i = s.data = [], o = e.ajax.xpath("//task", a), l = 0; l < o.length; l++) i[l] = this._xmlNodeToJSON(o[l]);
    return s.collections = this._getCollections(a), s;
  }, _copyLink: function(t) {
    return "<item id='" + t.id + "' source='" + t.source + "' target='" + t.target + "' type='" + t.type + "' />";
  }, _copyObject: function(t) {
    return "<task id='" + t.id + "' parent='" + (t.parent || "") + "' start_date='" + t.start_date + "' duration='" + t.duration + "' open='" + !!t.open + "' progress='" + t.progress + "' end_date='" + t.end_date + "'><![CDATA[" + t.text + "]]></task>";
  }, serialize: function() {
    for (var t = [], a = [], s = e.json.serialize(), i = 0, o = s.data.length; i < o; i++) t.push(this._copyObject(s.data[i]));
    for (i = 0, o = s.links.length; i < o; i++) a.push(this._copyLink(s.links[i]));
    return "<data>" + t.join("") + "<coll_options for='links'>" + a.join("") + "</coll_options></data>";
  } }, e.oldxml = { parse: function(t, a) {
    a = e.xml._getXML(t, a, "projects");
    for (var s = { collections: { links: [] } }, i = s.data = [], o = e.ajax.xpath("//task", a), l = 0; l < o.length; l++) {
      i[l] = e.xml._xmlNodeToJSON(o[l]);
      var r = o[l].parentNode;
      r.tagName == "project" ? i[l].parent = "project-" + r.getAttribute("id") : i[l].parent = r.parentNode.getAttribute("id");
    }
    for (o = e.ajax.xpath("//project", a), l = 0; l < o.length; l++)
      (d = e.xml._xmlNodeToJSON(o[l], !0)).id = "project-" + d.id, i.push(d);
    for (l = 0; l < i.length; l++) {
      var d;
      (d = i[l]).start_date = d.startdate || d.est, d.end_date = d.enddate, d.text = d.name, d.duration = d.duration / 8, d.open = 1, d.duration || d.end_date || (d.duration = 1), d.predecessortasks && s.collections.links.push({ target: d.id, source: d.predecessortasks, type: e.config.links.finish_to_start });
    }
    return s;
  }, serialize: function() {
    e.message("Serialization to 'old XML' is not implemented");
  } }, e.serverList = function(t, a) {
    return a ? this.serverList[t] = a.slice(0) : this.serverList[t] || (this.serverList[t] = []), this.serverList[t];
  };
}
function be(e, n, t, a, s) {
  return this.date = e, this.unit = n, this.task = t, this.id = a, this.calendar = s, this;
}
function Se(e, n, t, a, s, i) {
  return this.date = e, this.dir = n, this.unit = t, this.task = a, this.id = s, this.calendar = i, this;
}
function Te(e, n, t, a, s, i, o) {
  return this.start_date = e, this.duration = n, this.unit = t, this.step = a, this.task = s, this.id = i, this.calendar = o, this;
}
function _n(e, n, t, a) {
  return this.start_date = e, this.end_date = n, this.task = t, this.calendar = a, this.unit = null, this.step = null, this;
}
ct.prototype = { init: function(e) {
  var n = this.$gantt, t = n._waiAria.gridAttrString(), a = n._waiAria.gridDataAttrString(), s = this.$getConfig(), i = s.reorder_grid_columns || !1;
  this.$config.reorder_grid_columns !== void 0 && (i = this.$config.reorder_grid_columns), e.innerHTML = "<div class='gantt_grid' style='height:inherit;width:inherit;' " + t + "></div>", this.$grid = e.childNodes[0], this.$grid.innerHTML = "<div class='gantt_grid_scale' " + n._waiAria.gridScaleRowAttrString() + "></div><div class='gantt_grid_data' " + a + "></div>", this.$grid_scale = this.$grid.childNodes[0], this.$grid_data = this.$grid.childNodes[1];
  var o = s[this.$config.bind + "_attribute"];
  if (!o && this.$config.bind && (o = "data-" + this.$config.bind + "-id"), this.$config.item_attribute = o || null, !this.$config.layers) {
    var l = this._createLayerConfig();
    this.$config.layers = l;
  }
  var r = function(c, u) {
    var _ = { column_before_start: c.bind(function(h, g, p) {
      var k = u.$getConfig(), v = oe(p, k.grid_resizer_column_attribute);
      if (!v || !ot(v, ".gantt_grid_column_resize_wrap")) return !1;
      var f = this.locate(p, k.grid_resizer_column_attribute), y = u.getGridColumns()[f];
      return u.callEvent("onColumnResizeStart", [f, y]) !== !1 && void 0;
    }, c), column_after_start: c.bind(function(h, g, p) {
      var k = u.$getConfig(), v = this.locate(p, k.grid_resizer_column_attribute);
      h.config.marker.innerHTML = "", h.config.marker.className += " gantt_grid_resize_area", h.config.marker.style.height = u.$grid.offsetHeight + "px", h.config.marker.style.top = "0px", h.config.drag_index = v;
    }, c), column_drag_move: c.bind(function(h, g, p) {
      var k = u.$getConfig(), v = h.config, f = u.getGridColumns(), y = parseInt(v.drag_index, 10), m = f[y], S = xe(u.$grid_scale), C = parseInt(v.marker.style.left, 10), b = m.min_width ? m.min_width : k.min_grid_column_width, T = u.$grid_data.offsetWidth, x = 0, w = 0;
      k.rtl ? C = S.x + S.width - 1 - C : C -= S.x - 1;
      for (var E = 0; E < y; E++) b += f[E].width, x += f[E].width;
      if (C < b && (C = b), k.keep_grid_width) {
        var $ = 0;
        for (E = y + 1; E < f.length; E++) f[E].min_width ? T -= f[E].min_width : k.min_grid_column_width && (T -= k.min_grid_column_width), f[E].max_width && $ !== !1 ? $ += f[E].max_width : $ = !1;
        $ && (b = u.$grid_data.offsetWidth - $), C < b && (C = b), C > T && (C = T);
      } else if (!u.$config.scrollable) {
        var A = C, D = c.$container.offsetWidth, L = 0;
        if (u.$grid_data.offsetWidth <= D - 25) for (E = y + 1; E < f.length; E++) L += f[E].width;
        else {
          for (E = y + 1; E >= 0; E--) L += f[E].width;
          L = D - L;
        }
        L > D && (L -= D);
        var M = u.$parent.$parent;
        if (M && M.$config.mode == "y") {
          var I = M.$lastSize.x;
          D = Math.min(D, I - (M.$cells.length - 1));
        }
        A + L > D && (C = D - L);
      }
      return v.left = C - 1, w = Math.abs(C - x), m.max_width && w > m.max_width && (w = m.max_width), k.rtl && (x = S.width - x + 2 - w), v.marker.style.top = S.y + "px", v.marker.style.left = S.x - 1 + x + "px", v.marker.style.width = w + "px", u.callEvent("onColumnResize", [y, f[y], w - 1]), !0;
    }, c), column_drag_end: c.bind(function(h, g, p) {
      for (var k = u.$getConfig(), v = u.getGridColumns(), f = 0, y = parseInt(h.config.drag_index, 10), m = v[y], S = 0; S < y; S++) f += v[S].width;
      var C = m.min_width && h.config.left - f < m.min_width ? m.min_width : h.config.left - f;
      if (m.max_width && m.max_width < C && (C = m.max_width), u.callEvent("onColumnResizeEnd", [y, m, C]) !== !1 && m.width != C) {
        if (m.width = C, k.keep_grid_width) f = k.grid_width;
        else {
          S = y;
          for (var b = v.length; S < b; S++) f += v[S].width;
        }
        u.callEvent("onColumnResizeComplete", [v, u._setColumnsWidth(f, y)]), u.$config.scrollable || c.$layout._syncCellSizes(u.$config.group, { value: k.grid_width, isGravity: !1 }), this.render();
      }
    }, c) };
    return { init: function() {
      var h = c.$services.getService("dnd"), g = u.$getConfig(), p = new h(u.$grid_scale, { updates_per_second: 60 });
      c.defined(g.dnd_sensitivity) && (p.config.sensitivity = g.dnd_sensitivity), p.attachEvent("onBeforeDragStart", function(k, v) {
        return _.column_before_start(p, k, v);
      }), p.attachEvent("onAfterDragStart", function(k, v) {
        return _.column_after_start(p, k, v);
      }), p.attachEvent("onDragMove", function(k, v) {
        return _.column_drag_move(p, k, v);
      }), p.attachEvent("onDragEnd", function(k, v) {
        return _.column_drag_end(p, k, v);
      });
    }, doOnRender: function() {
      for (var h = u.getGridColumns(), g = u.$getConfig(), p = 0, k = u.$config.width, v = g.scale_height, f = 0; f < h.length; f++) {
        var y, m = h[f];
        if (p += m.width, y = g.rtl ? k - p : p, m.resize && f != h.length - 1) {
          var S = document.createElement("div");
          S.className = "gantt_grid_column_resize_wrap", S.style.top = "0px", S.style.height = v + "px", S.innerHTML = "<div class='gantt_grid_column_resize'></div>", S.setAttribute(g.grid_resizer_column_attribute, f), S.setAttribute("column_index", f), c._waiAria.gridSeparatorAttr(S), u.$grid_scale.appendChild(S), S.style.left = Math.max(0, y) + "px";
        }
      }
    } };
  }(n, this);
  r.init(), this._renderHeaderResizers = r.doOnRender, this._mouseDelegates = /* @__PURE__ */ function(c) {
    var u = [];
    return { delegate: function(_, h, g, p) {
      u.push([_, h, g, p]), c.$services.getService("mouseEvents").delegate(_, h, g, p);
    }, destructor: function() {
      for (var _ = c.$services.getService("mouseEvents"), h = 0; h < u.length; h++) {
        var g = u[h];
        _.detach(g[0], g[1], g[2], g[3]);
      }
      u = [];
    } };
  }(n);
  var d = function(c, u) {
    var _ = { row_before_start: c.bind(function(h, g, p) {
      var k = u.$getConfig(), v = u.$config.rowStore;
      if (!oe(p, k.task_grid_row_resizer_attribute)) return !1;
      var f = this.locate(p, k.task_grid_row_resizer_attribute), y = v.getItem(f);
      return u.callEvent("onBeforeRowResize", [y]) !== !1 && void 0;
    }, c), row_after_start: c.bind(function(h, g, p) {
      var k = u.$getConfig(), v = this.locate(p, k.task_grid_row_resizer_attribute);
      h.config.marker.innerHTML = "", h.config.marker.className += " gantt_row_grid_resize_area", h.config.marker.style.width = u.$grid.offsetWidth + "px", h.config.drag_id = v;
    }, c), row_drag_move: c.bind(function(h, g, p) {
      var k = u.$config.rowStore, v = u.$getConfig(), f = h.config, y = f.drag_id, m = u.getItemHeight(y), S = u.getItemTop(y) - g.scrollTop, C = xe(u.$grid_data), b = parseInt(f.marker.style.top, 10), T = S + C.y, x = 0, w = v.min_task_grid_row_height;
      return (x = b - T) < w && (x = w), f.marker.style.left = C.x + "px", f.marker.style.top = T - 1 + "px", f.marker.style.height = Math.abs(x) + 1 + "px", f.marker_height = x, u.callEvent("onRowResize", [y, k.getItem(y), x + m]), !0;
    }, c), row_drag_end: c.bind(function(h, g, p) {
      var k = u.$config.rowStore, v = h.config, f = v.drag_id, y = k.getItem(f), m = u.getItemHeight(f), S = v.marker_height;
      u.callEvent("onBeforeRowResizeEnd", [f, y, S]) !== !1 && y.row_height != S && (y.row_height = S, k.updateItem(f), u.callEvent("onAfterRowResize", [f, y, m, S]), this.render());
    }, c) };
    return { init: function() {
      var h = c.$services.getService("dnd"), g = u.$getConfig(), p = new h(u.$grid_data, { updates_per_second: 60 });
      c.defined(g.dnd_sensitivity) && (p.config.sensitivity = g.dnd_sensitivity), p.attachEvent("onBeforeDragStart", function(k, v) {
        return _.row_before_start(p, k, v);
      }), p.attachEvent("onAfterDragStart", function(k, v) {
        return _.row_after_start(p, k, v);
      }), p.attachEvent("onDragMove", function(k, v) {
        return _.row_drag_move(p, k, v);
      }), p.attachEvent("onDragEnd", function(k, v) {
        return _.row_drag_end(p, k, v);
      });
    } };
  }(n, this);
  d.init(), this._addLayers(this.$gantt), this._initEvents(), i && (this._columnDND = new cn(n, this), this._columnDND.init()), this.callEvent("onReady", []);
}, _validateColumnWidth: function(e, n) {
  var t = e[n];
  if (t && t != "*") {
    var a = this.$gantt, s = 1 * t;
    isNaN(s) ? a.assert(!1, "Wrong " + n + " value of column " + e.name) : e[n] = s;
  }
}, setSize: function(e, n) {
  this.$config.width = this.$state.width = e, this.$config.height = this.$state.height = n;
  for (var t, a = this.getGridColumns(), s = 0, i = (d = this.$getConfig()).grid_elastic_columns, o = 0, l = a.length; o < l; o++) this._validateColumnWidth(a[o], "min_width"), this._validateColumnWidth(a[o], "max_width"), this._validateColumnWidth(a[o], "width"), s += 1 * a[o].width;
  if (!isNaN(s) && this.$config.scrollable || (s = t = this._setColumnsWidth(e + 1)), this.$config.scrollable && i && !isNaN(s)) {
    let u = "width";
    i == "min_width" && (u = "min_width");
    let _ = 0;
    a.forEach(function(h) {
      _ += h[u] || d.min_grid_column_width;
    });
    var r = Math.max(_, e);
    s = this._setColumnsWidth(r), t = e;
  }
  this.$config.scrollable ? (this.$grid_scale.style.width = s + "px", this.$grid_data.style.width = s + "px") : (this.$grid_scale.style.width = "inherit", this.$grid_data.style.width = "inherit"), this.$config.width -= 1;
  var d = this.$getConfig();
  t !== e && (t !== void 0 ? (d.grid_width = t, this.$config.width = t - 1) : isNaN(s) || (this._setColumnsWidth(s), d.grid_width = s, this.$config.width = s - 1));
  var c = Math.max(this.$state.height - d.scale_height, 0);
  this.$grid_data.style.height = c + "px", this.refresh();
}, getSize: function() {
  var e = this.$getConfig(), n = this.$config.rowStore ? this.getTotalHeight() : 0, t = this._getGridWidth();
  return { x: this.$state.width, y: this.$state.height, contentX: this.isVisible() ? t : 0, contentY: this.isVisible() ? e.scale_height + n : 0, scrollHeight: this.isVisible() ? n : 0, scrollWidth: this.isVisible() ? t : 0 };
}, _bindStore: function() {
  if (this.$config.bind) {
    var e = this.$gantt.getDatastore(this.$config.bind);
    if (this.$config.rowStore = e, e && !e._gridCacheAttached) {
      var n = this;
      e._gridCacheAttached = e.attachEvent("onBeforeFilter", function() {
        n._resetTopPositionHeight();
      });
    }
  }
}, _unbindStore: function() {
  if (this.$config.bind) {
    var e = this.$gantt.getDatastore(this.$config.bind);
    e && e._gridCacheAttached && (e.detachEvent(e._gridCacheAttached), e._gridCacheAttached = !1);
  }
}, refresh: function() {
  this._bindStore(), this._resetTopPositionHeight(), this._resetHeight(), this._initSmartRenderingPlaceholder(), this._calculateGridWidth(), this._renderGridHeader();
}, getViewPort: function() {
  var e = this.$config.scrollLeft || 0, n = this.$config.scrollTop || 0, t = this.$config.height || 0, a = this.$config.width || 0;
  return { y: n, y_end: n + t, x: e, x_end: e + a, height: t, width: a };
}, scrollTo: function(e, n) {
  if (this.isVisible()) {
    var t = !1;
    this.$config.scrollTop = this.$config.scrollTop || 0, this.$config.scrollLeft = this.$config.scrollLeft || 0, 1 * e == e && (this.$config.scrollLeft = this.$state.scrollLeft = this.$grid.scrollLeft = e, t = !0), 1 * n == n && (this.$config.scrollTop = this.$state.scrollTop = this.$grid_data.scrollTop = n, t = !0), t && this.callEvent("onScroll", [this.$config.scrollLeft, this.$config.scrollTop]);
  }
}, getColumnIndex: function(e, n) {
  for (var t = this.$getConfig().columns, a = 0, s = 0; s < t.length; s++) if (n && t[s].hide && a++, t[s].name == e) return s - a;
  return null;
}, getColumn: function(e) {
  var n = this.getColumnIndex(e);
  return n === null ? null : this.$getConfig().columns[n];
}, getGridColumns: function() {
  return this.$getConfig().columns.slice();
}, isVisible: function() {
  return this.$parent && this.$parent.$config ? !this.$parent.$config.hidden : this.$grid.offsetWidth;
}, _createLayerConfig: function() {
  var e = this.$gantt, n = this;
  return [{ renderer: e.$ui.layers.gridLine(), container: this.$grid_data, filter: [function() {
    return n.isVisible();
  }] }, { renderer: e.$ui.layers.gridTaskRowResizer(), container: this.$grid_data, append: !0, filter: [function() {
    return e.config.resize_rows;
  }] }];
}, _addLayers: function(e) {
  if (this.$config.bind) {
    this._taskLayers = [];
    var n = this, t = this.$gantt.$services.getService("layers"), a = t.getDataRender(this.$config.bind);
    a || (a = t.createDataRender({ name: this.$config.bind, defaultContainer: function() {
      return n.$grid_data;
    } }));
    for (var s = this.$config.layers, i = 0; s && i < s.length; i++) {
      var o = s[i];
      o.view = this;
      var l = a.addLayer(o);
      this._taskLayers.push(l);
    }
    this._bindStore(), this._initSmartRenderingPlaceholder();
  }
}, _refreshPlaceholderOnStoreUpdate: function(e) {
  var n = this.$getConfig(), t = this.$config.rowStore;
  if (t && e === null && this.isVisible() && n.smart_rendering) {
    var a;
    if (this.$config.scrollY) {
      var s = this.$gantt.$ui.getView(this.$config.scrollY);
      s && (a = s.getScrollState().scrollSize);
    }
    if (a || (a = t ? this.getTotalHeight() : 0), a) {
      this.$rowsPlaceholder && this.$rowsPlaceholder.parentNode && this.$rowsPlaceholder.parentNode.removeChild(this.$rowsPlaceholder);
      var i = this.$rowsPlaceholder = document.createElement("div");
      i.style.visibility = "hidden", i.style.height = a + "px", i.style.width = "1px", this.$grid_data.appendChild(i);
    }
  }
}, _initSmartRenderingPlaceholder: function() {
  var e = this.$config.rowStore;
  e && (this._initSmartRenderingPlaceholder = function() {
  }, this._staticBgHandler = e.attachEvent("onStoreUpdated", O(this._refreshPlaceholderOnStoreUpdate, this)));
}, _initEvents: function() {
  var e = this.$gantt;
  this._mouseDelegates.delegate("click", "gantt_close", e.bind(function(n, t, a) {
    var s = this.$config.rowStore;
    if (!s) return !0;
    var i = oe(n, this.$config.item_attribute);
    return i && s.close(i.getAttribute(this.$config.item_attribute)), !1;
  }, this), this.$grid), this._mouseDelegates.delegate("click", "gantt_open", e.bind(function(n, t, a) {
    var s = this.$config.rowStore;
    if (!s) return !0;
    var i = oe(n, this.$config.item_attribute);
    return i && s.open(i.getAttribute(this.$config.item_attribute)), !1;
  }, this), this.$grid);
}, _clearLayers: function(e) {
  var n = this.$gantt.$services.getService("layers").getDataRender(this.$config.bind);
  if (this._taskLayers) for (var t = 0; t < this._taskLayers.length; t++) n.removeLayer(this._taskLayers[t]);
  this._taskLayers = [];
}, _getColumnWidth: function(e, n, t) {
  var a = e.min_width || n.min_grid_column_width, s = Math.max(t, a || 10);
  return e.max_width && (s = Math.min(s, e.max_width)), s;
}, _checkGridColumnMinWidthLimits: function(e, n) {
  for (var t = 0, a = e.length; t < a; t++) {
    var s = 1 * e[t].width;
    !e[t].min_width && s < n.min_grid_column_width && (e[t].min_width = s);
  }
}, _getGridWidthLimits: function() {
  for (var e = this.$getConfig(), n = this.getGridColumns(), t = 0, a = 0, s = 0; s < n.length; s++) t += n[s].min_width ? n[s].min_width : e.min_grid_column_width, a !== void 0 && (a = n[s].max_width ? a + n[s].max_width : void 0);
  return this._checkGridColumnMinWidthLimits(n, e), [t, a];
}, _setColumnsWidth: function(e, n) {
  var t = this.$getConfig(), a = this.getGridColumns(), s = 0, i = e;
  n = window.isNaN(n) ? -1 : n;
  for (var o = 0, l = a.length; o < l; o++) s += 1 * a[o].width;
  if (window.isNaN(s))
    for (this._calculateGridWidth(), s = 0, o = 0, l = a.length; o < l; o++) s += 1 * a[o].width;
  var r = i - s, d = 0;
  for (o = 0; o < n + 1; o++) d += a[o].width;
  for (s -= d, o = n + 1; o < a.length; o++) {
    var c = a[o], u = Math.round(r * (c.width / s));
    r < 0 ? c.min_width && c.width + u < c.min_width ? u = c.min_width - c.width : !c.min_width && t.min_grid_column_width && c.width + u < t.min_grid_column_width && (u = t.min_grid_column_width - c.width) : c.max_width && c.width + u > c.max_width && (u = c.max_width - c.width), s -= c.width, c.width += u, r -= u;
  }
  for (var _ = r > 0 ? 1 : -1; r > 0 && _ === 1 || r < 0 && _ === -1; ) {
    var h = r;
    for (o = n + 1; o < a.length; o++) {
      var g;
      if ((g = a[o].width + _) == this._getColumnWidth(a[o], t, g) && (r -= _, a[o].width = g), !r) break;
    }
    if (h == r) break;
  }
  return r && n > -1 && (g = a[n].width + r) == this._getColumnWidth(a[n], t, g) && (a[n].width = g), this._getColsTotalWidth();
}, _getColsTotalWidth: function() {
  for (var e = this.getGridColumns(), n = 0, t = 0; t < e.length; t++) {
    var a = parseFloat(e[t].width);
    if (window.isNaN(a)) return !1;
    n += a;
  }
  return n;
}, _calculateGridWidth: function() {
  for (var e = this.$getConfig(), n = this.getGridColumns(), t = 0, a = [], s = [], i = 0; i < n.length; i++) {
    var o = parseFloat(n[i].width);
    window.isNaN(o) && (o = e.min_grid_column_width || 10, a.push(i)), s[i] = o, t += o;
  }
  var l = this._getGridWidth() + 1;
  if (e.autofit || a.length) {
    var r = l - t;
    if (e.autofit && !e.grid_elastic_columns) for (i = 0; i < s.length; i++) {
      var d = Math.round(r / (s.length - i));
      s[i] += d, (c = this._getColumnWidth(n[i], e, s[i])) != s[i] && (d = c - s[i], s[i] = c), r -= d;
    }
    else if (a.length) for (i = 0; i < a.length; i++) {
      d = Math.round(r / (a.length - i));
      var c, u = a[i];
      s[u] += d, (c = this._getColumnWidth(n[u], e, s[u])) != s[u] && (d = c - s[u], s[u] = c), r -= d;
    }
    for (i = 0; i < s.length; i++) n[i].width = s[i];
  } else {
    var _ = l != t;
    this.$config.width = t - 1, e.grid_width = t, _ && this.$parent._setContentSize(this.$config.width, null);
  }
}, _renderGridHeader: function() {
  var e = this.$gantt, n = this.$getConfig(), t = this.$gantt.locale, a = this.$gantt.templates, s = this.getGridColumns();
  n.rtl && (s = s.reverse());
  var i = [], o = 0, l = t.labels, r = n.scale_height - 1;
  const d = {};
  for (var c = 0; c < s.length; c++) {
    var u = c == s.length - 1, _ = s[c];
    _.name || (_.name = e.uid() + "");
    var h = 1 * _.width, g = this._getGridWidth();
    u && g > o + h && (_.width = h = g - o), o += h;
    var p = e._sort && _.name == e._sort.name ? `<div data-column-id="${_.name}" class="gantt_sort gantt_${e._sort.direction}"></div>` : "", k = ["gantt_grid_head_cell", "gantt_grid_head_" + _.name, u ? "gantt_last_cell" : "", a.grid_header_class(_.name, _)].join(" "), v = "width:" + (h - (u ? 1 : 0)) + "px;", f = _.label || l["column_" + _.name] || l[_.name];
    typeof f == "function" && (f = f.call(e, _.name, _)), f = f || "";
    let m = !1;
    e.config.external_render && e.config.external_render.isElement(f) && (m = !0, d[_.name] = f);
    var y = "<div class='" + k + "' style='" + v + "' " + e._waiAria.gridScaleCellAttrString(_, f) + " data-column-id='" + _.name + "' column_id='" + _.name + "' data-column-name='" + _.name + "' data-column-index='" + c + "'>" + (m ? "<div data-component-container></div>" : f) + p + "</div>";
    i.push(y);
  }
  this.$grid_scale.style.height = n.scale_height + "px", this.$grid_scale.style.lineHeight = r + "px", this.$grid_scale.innerHTML = i.join("");
  for (let m in d) e.config.external_render.renderElement(d[m], this.$grid_scale.querySelector("[data-column-id='" + m + "'] [data-component-container]"));
  this._renderHeaderResizers && this._renderHeaderResizers();
}, _getGridWidth: function() {
  return this.$config.width;
}, destructor: function() {
  this._clearLayers(this.$gantt), this._mouseDelegates && (this._mouseDelegates.destructor(), this._mouseDelegates = null), this._unbindStore(), this.$grid = null, this.$grid_scale = null, this.$grid_data = null, this.$gantt = null, this.$config.rowStore && (this.$config.rowStore.detachEvent(this._staticBgHandler), this.$config.rowStore = null), this.callEvent("onDestroy", []), this.detachAllEvents();
} };
var ut = function(e) {
  return { getWorkHoursArguments: function() {
    var n = arguments[0];
    if (!X((n = G(n) ? { date: n } : B({}, n)).date)) throw e.assert(!1, "Invalid date argument for getWorkHours method"), new Error("Invalid date argument for getWorkHours method");
    return n;
  }, setWorkTimeArguments: function() {
    return arguments[0];
  }, unsetWorkTimeArguments: function() {
    return arguments[0];
  }, isWorkTimeArguments: function() {
    var n, t = arguments[0];
    if (t instanceof be) return t;
    if ((n = t.date ? new be(t.date, t.unit, t.task, null, t.calendar) : new be(arguments[0], arguments[1], arguments[2], null, arguments[3])).unit = n.unit || e.config.duration_unit, !X(n.date)) throw e.assert(!1, "Invalid date argument for isWorkTime method"), new Error("Invalid date argument for isWorkTime method");
    return n;
  }, getClosestWorkTimeArguments: function(n) {
    var t, a = arguments[0];
    if (a instanceof Se) return a;
    if (t = G(a) ? new Se(a) : new Se(a.date, a.dir, a.unit, a.task, null, a.calendar), a.id && (t.task = a), t.dir = a.dir || "any", t.unit = a.unit || e.config.duration_unit, !X(t.date)) throw e.assert(!1, "Invalid date argument for getClosestWorkTime method"), new Error("Invalid date argument for getClosestWorkTime method");
    return t;
  }, _getStartEndConfig: function(n) {
    var t, a = _n;
    if (n instanceof a) return n;
    if (G(n) ? t = new a(arguments[0], arguments[1], arguments[2], arguments[3]) : (t = new a(n.start_date, n.end_date, n.task), n.id !== null && n.id !== void 0 && (t.task = n)), t.unit = t.unit || e.config.duration_unit, t.step = t.step || e.config.duration_step, t.start_date = t.start_date || t.start || t.date, !X(t.start_date)) throw e.assert(!1, "Invalid start_date argument for getDuration method"), new Error("Invalid start_date argument for getDuration method");
    if (!X(t.end_date)) throw e.assert(!1, "Invalid end_date argument for getDuration method"), new Error("Invalid end_date argument for getDuration method");
    return t;
  }, getDurationArguments: function(n, t, a, s) {
    return this._getStartEndConfig.apply(this, arguments);
  }, hasDurationArguments: function(n, t, a, s) {
    return this._getStartEndConfig.apply(this, arguments);
  }, calculateEndDateArguments: function(n, t, a, s) {
    var i, o = arguments[0];
    if (o instanceof Te) return o;
    if (i = G(o) ? new Te(arguments[0], arguments[1], arguments[2], void 0, arguments[3], void 0, arguments[4]) : new Te(o.start_date, o.duration, o.unit, o.step, o.task, null, o.calendar), o.id !== null && o.id !== void 0 && (i.task = o, i.unit = null, i.step = null), i.unit = i.unit || e.config.duration_unit, i.step = i.step || e.config.duration_step, !X(i.start_date)) throw e.assert(!1, "Invalid start_date argument for calculateEndDate method"), new Error("Invalid start_date argument for calculateEndDate method");
    return i;
  } };
};
function _t() {
}
_t.prototype = { _getIntervals: function(e) {
  for (var n = [], t = 0; t < e.length; t += 2) n.push({ start: e[t], end: e[t + 1] });
  return n;
}, _toHoursArray: function(e) {
  var n = [];
  function t(s) {
    var i, o = Math.floor(s / 3600), l = s - 60 * o * 60, r = Math.floor(l / 60);
    return o + ":" + ((i = String(r)).length < 2 && (i = "0" + i), i);
  }
  for (var a = 0; a < e.length; a++) n.push(t(e[a].start) + "-" + t(e[a].end));
  return n;
}, _intersectHourRanges: function(e, n) {
  var t = [], a = e.length > n.length ? e : n, s = e === a ? n : e;
  a = a.slice(), s = s.slice(), t = [];
  for (var i = 0; i < a.length; i++) for (var o = a[i], l = 0; l < s.length; l++) {
    var r = s[l];
    r.start < o.end && r.end > o.start && (t.push({ start: Math.max(o.start, r.start), end: Math.min(o.end, r.end) }), o.end > r.end && (s.splice(l, 1), l--, i--));
  }
  return t;
}, _mergeAdjacentIntervals: function(e) {
  var n = e.slice();
  n.sort(function(i, o) {
    return i.start - o.start;
  });
  for (var t = n[0], a = 1; a < n.length; a++) {
    var s = n[a];
    s.start <= t.end ? (s.end > t.end && (t.end = s.end), n.splice(a, 1), a--) : t = s;
  }
  return n;
}, _mergeHoursConfig: function(e, n) {
  return this._mergeAdjacentIntervals(this._intersectHourRanges(e, n));
}, merge: function(e, n) {
  const t = J(e.getConfig()), a = J(n.getConfig()), s = t.parsed, i = a.parsed;
  s.customWeeks = t.customWeeks, i.customWeeks = a.customWeeks;
  var o = { hours: this._toHoursArray(this._mergeHoursConfig(s.hours, i.hours)), dates: {}, customWeeks: {} };
  const l = (d, c) => {
    for (let u in d.dates) {
      const _ = d.dates[u];
      +u > 1e3 && (o.dates[u] = !1);
      for (const h in c.dates) {
        const g = c.dates[h];
        if (h == u && (o.dates[u] = !(!_ || !g)), Array.isArray(_)) {
          const p = Array.isArray(g) ? g : c.hours;
          o.dates[u] = this._toHoursArray(this._mergeHoursConfig(_, p));
        }
      }
    }
  };
  if (l(s, i), l(i, s), s.customWeeks) for (var r in s.customWeeks) o.customWeeks[r] = s.customWeeks[r];
  if (i.customWeeks) for (var r in i.customWeeks) o.customWeeks[r] ? o.customWeeks[r + "_second"] = i.customWeeks[r] : o.customWeeks[r] = i.customWeeks[r];
  return o;
} };
class hn {
  constructor() {
    this.clear();
  }
  getItem(n, t, a) {
    if (this._cache.has(n)) {
      const s = this._cache.get(n)[a.getFullYear()];
      if (s && s.has(t)) return s.get(t);
    }
    return -1;
  }
  setItem(n, t, a, s) {
    if (!n || !t) return;
    const i = this._cache, o = s.getFullYear();
    let l;
    i.has(n) ? l = i.get(n) : (l = [], i.set(n, l));
    let r = l[o];
    r || (r = l[o] = /* @__PURE__ */ new Map()), r.set(t, a);
  }
  clear() {
    this._cache = /* @__PURE__ */ new Map();
  }
}
class gn {
  constructor() {
    this.clear();
  }
  getItem(n, t, a) {
    const s = this._cache;
    if (s && s[n]) {
      const i = s[n];
      if (i === void 0) return -1;
      const o = i[a.getFullYear()];
      if (o && o[t] !== void 0) return o[t];
    }
    return -1;
  }
  setItem(n, t, a, s) {
    if (!n || !t) return;
    const i = this._cache;
    if (!i) return;
    i[n] || (i[n] = []);
    const o = i[n], l = s.getFullYear();
    let r = o[l];
    r || (r = o[l] = {}), r[t] = a;
  }
  clear() {
    this._cache = {};
  }
}
class fn {
  constructor(n) {
    this.getMinutesPerWeek = (t) => {
      const a = t.valueOf();
      if (this._weekCache.has(a)) return this._weekCache.get(a);
      const s = this._calendar, i = this._calendar.$gantt;
      let o = 0, l = i.date.week_start(new Date(t));
      for (let r = 0; r < 7; r++) o += 60 * s.getHoursPerDay(l), l = i.date.add(l, 1, "day");
      return this._weekCache.set(a, o), o;
    }, this.getMinutesPerMonth = (t) => {
      const a = t.valueOf();
      if (this._monthCache.has(a)) return this._monthCache.get(a);
      const s = this._calendar, i = this._calendar.$gantt;
      let o = 0, l = i.date.week_start(new Date(t));
      const r = i.date.add(l, 1, "month").valueOf();
      for (; l.valueOf() < r; ) o += 60 * s.getHoursPerDay(l), l = i.date.add(l, 1, "day");
      return this._monthCache.set(a, o), o;
    }, this.clear = () => {
      this._weekCache = /* @__PURE__ */ new Map(), this._monthCache = /* @__PURE__ */ new Map();
    }, this.clear(), this._calendar = n;
  }
}
class pn {
  constructor() {
    this.clear();
  }
  _getCacheObject(n, t, a) {
    const s = this._cache;
    s[t] || (s[t] = []);
    let i = s[t];
    i || (i = s[t] = {});
    let o = i[a];
    o || (o = i[a] = {});
    const l = n.getFullYear();
    let r = o[l];
    return r || (r = o[l] = { durations: {}, endDates: {} }), r;
  }
  _endDateCacheKey(n, t) {
    return String(n) + "-" + String(t);
  }
  _durationCacheKey(n, t) {
    return String(n) + "-" + String(t);
  }
  getEndDate(n, t, a, s, i) {
    const o = this._getCacheObject(n, a, s), l = n.valueOf(), r = this._endDateCacheKey(l, t);
    let d;
    if (o.endDates[r] === void 0) {
      const c = i(), u = c.valueOf();
      o.endDates[r] = u, o.durations[this._durationCacheKey(l, u)] = t, d = c;
    } else d = new Date(o.endDates[r]);
    return d;
  }
  getDuration(n, t, a, s, i) {
    const o = this._getCacheObject(n, a, s), l = n.valueOf(), r = t.valueOf(), d = this._durationCacheKey(l, r);
    let c;
    if (o.durations[d] === void 0) {
      const u = i();
      o.durations[d] = u.valueOf(), c = u;
    } else c = o.durations[d];
    return c;
  }
  clear() {
    this._cache = {};
  }
}
function Me(e, n) {
  this.argumentsHelper = n, this.$gantt = e, this._workingUnitsCache = typeof Map < "u" ? new hn() : new gn(), this._largeUnitsCache = new fn(this), this._dateDurationCache = new pn(), this._worktime = null, this._cached_timestamps = {}, this._cached_timestamps_count = 0;
}
Me.prototype = { units: ["year", "month", "week", "day", "hour", "minute"], _clearCaches: function() {
  this._workingUnitsCache.clear(), this._largeUnitsCache.clear(), this._dateDurationCache.clear();
}, _getUnitOrder: function(e) {
  for (var n = 0, t = this.units.length; n < t; n++) if (this.units[n] == e) return n;
}, _resetTimestampCache: function() {
  this._cached_timestamps = {}, this._cached_timestamps_count = 0;
}, _timestamp: function(e) {
  this._cached_timestamps_count > 1e6 && this._resetTimestampCache();
  var n = null;
  if (e.day || e.day === 0) n = e.day;
  else if (e.date) {
    var t = String(e.date.valueOf());
    this._cached_timestamps[t] ? n = this._cached_timestamps[t] : (n = Date.UTC(e.date.getFullYear(), e.date.getMonth(), e.date.getDate()), this._cached_timestamps[t] = n, this._cached_timestamps_count++);
  }
  return n;
}, _checkIfWorkingUnit: function(e, n) {
  if (!this["_is_work_" + n]) {
    const t = this.$gantt.date[`${n}_start`](new Date(e)), a = this.$gantt.date.add(t, 1, n);
    return this.hasDuration(t, a);
  }
  return this["_is_work_" + n](e);
}, _is_work_day: function(e) {
  var n = this._getWorkHours(e);
  return !!Array.isArray(n) && n.length > 0;
}, _is_work_hour: function(e) {
  for (var n = this._getWorkHours(e), t = e.getHours(), a = 0; a < n.length; a++) if (t >= n[a].startHour && t < n[a].endHour) return !0;
  return !1;
}, _getTimeOfDayStamp: function(e, n) {
  var t = e.getHours();
  return e.getHours() || e.getMinutes() || !n || (t = 24), 60 * t * 60 + 60 * e.getMinutes();
}, _is_work_minute: function(e) {
  for (var n = this._getWorkHours(e), t = this._getTimeOfDayStamp(e), a = 0; a < n.length; a++) if (t >= n[a].start && t < n[a].end) return !0;
  return !1;
}, _nextDate: function(e, n, t) {
  return this.$gantt.date.add(e, t, n);
}, _getWorkUnitsBetweenGeneric: function(e, n, t, a) {
  var s = this.$gantt.date, i = new Date(e), o = new Date(n);
  a = a || 1;
  var l, r, d = 0, c = null, u = !1;
  (l = s[t + "_start"](new Date(i))).valueOf() != i.valueOf() && (u = !0);
  var _ = !1;
  (r = s[t + "_start"](new Date(n))).valueOf() != n.valueOf() && (_ = !0);
  for (var h = !1; i.valueOf() < o.valueOf(); ) {
    if (h = (c = this._nextDate(i, t, a)).valueOf() > o.valueOf(), this._isWorkTime(i, t)) (u || _ && h) && (l = s[t + "_start"](new Date(i)), r = s.add(l, a, t)), u ? (u = !1, c = this._nextDate(l, t, a), d += (r.valueOf() - i.valueOf()) / (r.valueOf() - l.valueOf())) : _ && h ? (_ = !1, d += (o.valueOf() - i.valueOf()) / (r.valueOf() - l.valueOf())) : d++;
    else {
      var g = this._getUnitOrder(t), p = this.units[g - 1];
      p && !this._isWorkTime(i, p) && (c = this._getClosestWorkTimeFuture(i, p));
    }
    i = c;
  }
  return d;
}, _getMinutesPerHour: function(e) {
  var n = this._getTimeOfDayStamp(e), t = this._getTimeOfDayStamp(this._nextDate(e, "hour", 1));
  t === 0 && (t = 86400);
  for (var a = this._getWorkHours(e), s = 0; s < a.length; s++) {
    var i = a[s];
    if (n >= i.start && t <= i.end) return 60;
    if (n < i.end && t > i.start) return (Math.min(t, i.end) - Math.max(n, i.start)) / 60;
  }
  return 0;
}, _getMinutesPerDay: function(e) {
  var n = this._getWorkHours(e), t = 0;
  return n.forEach(function(a) {
    t += a.durationMinutes;
  }), t;
}, getHoursPerDay: function(e) {
  var n = this._getWorkHours(e), t = 0;
  return n.forEach(function(a) {
    t += a.durationHours;
  }), t;
}, _getWorkUnitsForRange: function(e, n, t, a) {
  var s, i = 0, o = new Date(e), l = new Date(n);
  for (s = O(t == "minute" ? this._getMinutesPerDay : this.getHoursPerDay, this); o.valueOf() < l.valueOf(); ) if (l - o > 27648e5 && o.getDate() === 0) {
    var r = this._largeUnitsCache.getMinutesPerMonth(o);
    t == "hour" && (r /= 60), i += r, o = this.$gantt.date.add(o, 1, "month");
  } else {
    if (l - o > 13824e5) {
      var d = this.$gantt.date.week_start(new Date(o));
      if (o.valueOf() === d.valueOf()) {
        r = this._largeUnitsCache.getMinutesPerWeek(o), t == "hour" && (r /= 60), i += r, o = this.$gantt.date.add(o, 7, "day");
        continue;
      }
    }
    i += s(o), o = this._nextDate(o, "day", 1);
  }
  return i / a;
}, _getMinutesBetweenSingleDay: function(e, n) {
  for (var t = this._getIntervalTimestamp(e, n), a = this._getWorkHours(e), s = 0, i = 0; i < a.length; i++) {
    var o = a[i];
    if (t.end >= o.start && t.start <= o.end) {
      var l = Math.max(o.start, t.start), r = Math.min(o.end, t.end);
      s += (r - l) / 60, t.start = r;
    }
  }
  return Math.floor(s);
}, _getMinutesBetween: function(e, n, t, a) {
  var s = new Date(e), i = new Date(n);
  a = a || 1;
  var o = new Date(s), l = this.$gantt.date.add(this.$gantt.date.day_start(new Date(s)), 1, "day");
  if (i.valueOf() <= l.valueOf()) return this._getMinutesBetweenSingleDay(e, n);
  var r = this.$gantt.date.day_start(new Date(i)), d = i, c = this._getMinutesBetweenSingleDay(o, l), u = this._getMinutesBetweenSingleDay(r, d);
  return c + this._getWorkUnitsForRange(l, r, t, a) + u;
}, _getHoursBetween: function(e, n, t, a) {
  var s = new Date(e), i = new Date(n);
  a = a || 1;
  var o = new Date(s), l = this.$gantt.date.add(this.$gantt.date.day_start(new Date(s)), 1, "day");
  if (i.valueOf() <= l.valueOf()) return Math.round(this._getMinutesBetweenSingleDay(e, n) / 60);
  var r = this.$gantt.date.day_start(new Date(i)), d = i, c = this._getMinutesBetweenSingleDay(o, l, t, a) / 60, u = this._getMinutesBetweenSingleDay(r, d, t, a) / 60, _ = c + this._getWorkUnitsForRange(l, r, t, a) + u;
  return Math.round(_);
}, getConfig: function() {
  return this._worktime;
}, _setConfig: function(e) {
  this._worktime = e, this._parseSettings(), this._clearCaches();
}, _parseSettings: function() {
  var e = this.getConfig();
  for (var n in e.parsed = { dates: {}, hours: null, haveCustomWeeks: !1, customWeeks: {}, customWeeksRangeStart: null, customWeeksRangeEnd: null, customWeeksBoundaries: [] }, e.parsed.hours = this._parseHours(e.hours), e.dates) e.parsed.dates[n] = this._parseHours(e.dates[n]);
  if (e.customWeeks) {
    var t = null, a = null;
    for (var n in e.customWeeks) {
      var s = e.customWeeks[n];
      if (s.from && s.to) {
        var i = s.from, o = s.to;
        (!t || t > i.valueOf()) && (t = i.valueOf()), (!a || a < o.valueOf()) && (a = o.valueOf()), e.parsed.customWeeksBoundaries.push({ from: i.valueOf(), fromReadable: new Date(i), to: o.valueOf(), toReadable: new Date(o), name: n }), e.parsed.haveCustomWeeks = !0;
        var l = e.parsed.customWeeks[n] = { from: s.from, to: s.to, hours: this._parseHours(s.hours), dates: {} };
        if (s.days && !s.dates) {
          for (s.dates = s.dates || {}, n = 0; n < s.days.length; n++) s.dates[n] = s.days[n], s.days[n] instanceof Array || (s.dates[n] = !!s.days[n]);
          delete s.days;
        }
        for (var r in s.dates) l.dates[r] = this._parseHours(s.dates[r]);
      }
    }
    e.parsed.customWeeksRangeStart = t, e.parsed.customWeeksRangeEnd = a;
  }
}, _tryChangeCalendarSettings: function(e) {
  var n = JSON.stringify(this.getConfig());
  return e(), !!this.hasWorkTime() || (this._setConfig(JSON.parse(n)), this._clearCaches(), !1);
}, _arraysEqual: function(e, n) {
  if (e === n) return !0;
  if (!e || !n || e.length != n.length) return !1;
  for (var t = 0; t < e.length; ++t) if (e[t] !== n[t]) return !1;
  return !0;
}, _compareSettings: function(e, n) {
  if (!this._arraysEqual(e.hours, n.hours)) return !1;
  var t = Object.keys(e.dates), a = Object.keys(n.dates);
  if (t.sort(), a.sort(), !this._arraysEqual(t, a)) return !1;
  for (var s = 0; s < t.length; s++) {
    var i = t[s], o = e.dates[i], l = e.dates[i];
    if (o !== l && !(Array.isArray(o) && Array.isArray(l) && this._arraysEqual(o, l))) return !1;
  }
  return !0;
}, equals: function(e) {
  if (!(e instanceof Me)) return !1;
  var n = this.getConfig(), t = e.getConfig();
  if (!this._compareSettings(n, t)) return !1;
  if (n.parsed.haveCustomWeeks && t.parsed.haveCustomWeeks) {
    if (n.parsed.customWeeksBoundaries.length != t.parsed.customWeeksBoundaries.length) return !1;
    for (var a in n.parsed.customWeeks) {
      var s = n.parsed.customWeeks[a], i = t.parsed.customWeeks[a];
      if (!i || !this._compareSettings(s, i)) return !1;
    }
  } else if (n.parse.haveCustomWeeks !== t.parsed.haveCustomWeeks) return !1;
  return !0;
}, getWorkHours: function() {
  var e = this.argumentsHelper.getWorkHoursArguments.apply(this.argumentsHelper, arguments);
  return this._getWorkHours(e.date, !1);
}, _getWorkHours: function(e, n) {
  var t = this.getConfig();
  if (n !== !1 && (t = t.parsed), !e) return t.hours;
  const a = new Date(e.getFullYear(), e.getMonth(), e.getDate());
  var s = this._timestamp({ date: a });
  if (t.haveCustomWeeks && t.customWeeksRangeStart <= s && t.customWeeksRangeEnd > s) {
    for (var i = 0; i < t.customWeeksBoundaries.length; i++) if (t.customWeeksBoundaries[i].from <= s && t.customWeeksBoundaries[i].to > s) {
      t = t.customWeeks[t.customWeeksBoundaries[i].name];
      break;
    }
  }
  var o = !0;
  return t.dates[s] !== void 0 ? o = t.dates[s] : t.dates[e.getDay()] !== void 0 && (o = t.dates[e.getDay()]), o === !0 ? t.hours : o || [];
}, _getIntervalTimestamp: function(e, n) {
  var t = { start: 0, end: 0 };
  t.start = 60 * e.getHours() * 60 + 60 * e.getMinutes() + e.getSeconds();
  var a = n.getHours();
  return !a && !n.getMinutes() && !n.getSeconds() && e.valueOf() < n.valueOf() && (a = 24), t.end = 60 * a * 60 + 60 * n.getMinutes() + n.getSeconds(), t;
}, _parseHours: function(e) {
  if (Array.isArray(e)) {
    var n = [];
    e.forEach(function(l) {
      typeof l == "number" ? n.push(60 * l * 60) : typeof l == "string" && l.split("-").map(function(r) {
        return r.trim();
      }).forEach(function(r) {
        var d = r.split(":").map(function(u) {
          return u.trim();
        }), c = parseInt(60 * d[0] * 60);
        d[1] && (c += parseInt(60 * d[1])), d[2] && (c += parseInt(d[2])), n.push(c);
      });
    });
    for (var t = [], a = 0; a < n.length; a += 2) {
      var s = n[a], i = n[a + 1], o = i - s;
      t.push({ start: s, end: i, startHour: Math.floor(s / 3600), startMinute: Math.floor(s / 60), endHour: Math.ceil(i / 3600), endMinute: Math.ceil(i / 60), durationSeconds: o, durationMinutes: o / 60, durationHours: o / 3600 });
    }
    return t;
  }
  return e;
}, setWorkTime: function(e) {
  return this._tryChangeCalendarSettings(O(function() {
    var n = e.hours === void 0 || e.hours, t = this._timestamp(e), a = this.getConfig();
    if (t !== null ? a.dates[t] = n : e.customWeeks || (a.hours = n), e.customWeeks) {
      if (a.customWeeks || (a.customWeeks = {}), typeof e.customWeeks == "string") t !== null ? a.customWeeks[e.customWeeks].dates[t] = n : e.customWeeks || (a.customWeeks[e.customWeeks].hours = n);
      else if (typeof e.customWeeks == "object" && e.customWeeks.constructor === Object) for (var s in e.customWeeks) a.customWeeks[s] = e.customWeeks[s];
    }
    this._parseSettings(), this._clearCaches();
  }, this));
}, unsetWorkTime: function(e) {
  return this._tryChangeCalendarSettings(O(function() {
    if (e) {
      var n = this._timestamp(e);
      n !== null && delete this.getConfig().dates[n];
    } else this.reset_calendar();
    this._parseSettings(), this._clearCaches();
  }, this));
}, _isWorkTime: function(e, n) {
  var t, a = -1;
  return t = String(e.valueOf()), (a = this._workingUnitsCache.getItem(n, t, e)) == -1 && (a = this._checkIfWorkingUnit(e, n), this._workingUnitsCache.setItem(n, t, a, e)), a;
}, isWorkTime: function() {
  var e = this.argumentsHelper.isWorkTimeArguments.apply(this.argumentsHelper, arguments);
  return this._isWorkTime(e.date, e.unit);
}, calculateDuration: function() {
  var e = this.argumentsHelper.getDurationArguments.apply(this.argumentsHelper, arguments);
  if (!e.unit) return !1;
  var n = this;
  return this._dateDurationCache.getDuration(e.start_date, e.end_date, e.unit, e.step, function() {
    return n._calculateDuration(e.start_date, e.end_date, e.unit, e.step);
  });
}, _calculateDuration: function(e, n, t, a) {
  var s = 0, i = 1;
  if (e.valueOf() > n.valueOf()) {
    var o = n;
    n = e, e = o, i = -1;
  }
  return s = t == "hour" && a == 1 ? this._getHoursBetween(e, n, t, a) : t == "minute" && a == 1 ? this._getMinutesBetween(e, n, t, a) : this._getWorkUnitsBetweenGeneric(e, n, t, a), i * Math.round(s);
}, hasDuration: function() {
  var e = this.argumentsHelper.getDurationArguments.apply(this.argumentsHelper, arguments), n = e.start_date, t = e.end_date, a = e.unit, s = e.step;
  if (!a) return !1;
  var i = new Date(n), o = new Date(t);
  for (s = s || 1; i.valueOf() < o.valueOf(); ) {
    if (this._isWorkTime(i, a)) return !0;
    i = this._nextDate(i, a, s);
  }
  return !1;
}, calculateEndDate: function() {
  var e = this.argumentsHelper.calculateEndDateArguments.apply(this.argumentsHelper, arguments), n = e.start_date, t = e.duration, a = e.unit, s = e.step;
  if (!a) return !1;
  var i = e.duration >= 0 ? 1 : -1;
  t = Math.abs(1 * t);
  var o = this;
  return this._dateDurationCache.getEndDate(n, t, a, s * i, function() {
    return o._calculateEndDate(n, t, a, s * i);
  });
}, _calculateEndDate: function(e, n, t, a) {
  return !!t && (a == 1 && t == "minute" ? this._calculateMinuteEndDate(e, n, a) : a == -1 && t == "minute" ? this._subtractMinuteDate(e, n, a) : a == 1 && t == "hour" ? this._calculateHourEndDate(e, n, a) : this._addInterval(e, n, t, a, null).end);
}, _addInterval: function(e, n, t, a, s) {
  for (var i = 0, o = e, l = !1; i < n && (!s || !s(o)); ) {
    var r = this._nextDate(o, t, a);
    t == "day" && (l = l || !o.getHours() && r.getHours()) && (r.setHours(0), r.getHours() || (l = !1));
    var d = new Date(r.valueOf() + 1);
    a > 0 && (d = new Date(r.valueOf() - 1)), this._isWorkTime(d, t) && !l && i++, o = r;
  }
  return { end: o, start: e, added: i };
}, _addHoursUntilDayEnd: function(e, n) {
  for (var t = this.$gantt.date.add(this.$gantt.date.day_start(new Date(e)), 1, "day"), a = 0, s = n, i = this._getIntervalTimestamp(e, t), o = this._getWorkHours(e), l = 0; l < o.length && a < n; l++) {
    var r = o[l];
    if (i.end >= r.start && i.start <= r.end) {
      var d = Math.max(r.start, i.start), c = Math.min(r.end, i.end), u = (c - d) / 3600;
      u > s && (u = s, c = d + 60 * s * 60);
      var _ = Math.round((c - d) / 3600);
      a += _, s -= _, i.start = c;
    }
  }
  var h = t;
  return a === n && (h = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, i.start)), { added: a, end: h };
}, _calculateHourEndDate: function(e, n, t) {
  var a = new Date(e), s = 0;
  t = t || 1, n = Math.abs(1 * n);
  var i = this._addHoursUntilDayEnd(a, n);
  if (s = i.added, a = i.end, d = n - s) {
    for (var o = a; s < n; ) {
      var l = this._nextDate(o, "day", t);
      l.setHours(0), l.setMinutes(0), l.setSeconds(0);
      var r = 0;
      if (s + (r = t > 0 ? this.getHoursPerDay(new Date(l.valueOf() - 1)) : this.getHoursPerDay(new Date(l.valueOf() + 1))) >= n) break;
      s += r, o = l;
    }
    a = o;
  }
  if (s < n) {
    var d = n - s;
    a = (i = this._addHoursUntilDayEnd(a, d)).end;
  }
  return a;
}, _addMinutesUntilHourEnd: function(e, n) {
  if (e.getMinutes() === 0) return { added: 0, end: new Date(e) };
  for (var t = this.$gantt.date.add(this.$gantt.date.hour_start(new Date(e)), 1, "hour"), a = 0, s = n, i = this._getIntervalTimestamp(e, t), o = this._getWorkHours(e), l = 0; l < o.length && a < n; l++) {
    var r = o[l];
    if (i.end >= r.start && i.start <= r.end) {
      var d = Math.max(r.start, i.start), c = Math.min(r.end, i.end), u = (c - d) / 60;
      u > s && (u = s, c = d + 60 * s);
      var _ = Math.round((c - d) / 60);
      s -= _, a += _, i.start = c;
    }
  }
  var h = t;
  return a === n && (h = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, i.start)), { added: a, end: h };
}, _subtractMinutesUntilHourStart: function(e, n) {
  for (var t = this.$gantt.date.hour_start(new Date(e)), a = 0, s = n, i = 60 * t.getHours() * 60 + 60 * t.getMinutes() + t.getSeconds(), o = 60 * e.getHours() * 60 + 60 * e.getMinutes() + e.getSeconds(), l = this._getWorkHours(e), r = l.length - 1; r >= 0 && a < n; r--) {
    var d = l[r];
    if (o > d.start && i <= d.end) {
      var c = Math.min(o, d.end), u = Math.max(i, d.start), _ = (c - u) / 60;
      _ > s && (_ = s, u = c - 60 * s);
      var h = Math.abs(Math.round((c - u) / 60));
      s -= h, a += h, o = u;
    }
  }
  var g = t;
  return a === n && (g = new Date(e.getFullYear(), e.getMonth(), e.getDate(), 0, 0, o)), { added: a, end: g };
}, _subtractMinuteDate: function(e, n, t) {
  var a = this.getClosestWorkTime({ date: e, dir: "past", unit: "minute" }), s = 0;
  t = t || -1, n = Math.abs(1 * n), n = Math.round(n);
  const i = this._isMinutePrecision(a);
  let o = this._subtractMinutesUntilHourStart(a, n);
  s += o.added, a = o.end;
  for (var l = 0, r = [], d = 0; s < n; ) {
    var c = this.$gantt.date.day_start(new Date(a)), u = !1;
    a.valueOf() === c.valueOf() && (c = this.$gantt.date.add(c, -1, "day"), u = !0);
    var _ = new Date(c.getFullYear(), c.getMonth(), c.getDate(), 23, 59, 59, 999).valueOf();
    _ !== l && (r = this._getWorkHours(c), d = this._getMinutesPerDay(c), l = _);
    var h = n - s, g = this._getTimeOfDayStamp(a, u);
    if (r.length && d) if (r[r.length - 1].end <= g && h > d) s += d, a = this.$gantt.date.add(a, -1, "day");
    else {
      for (var p = !1, k = null, v = null, f = r.length - 1; f >= 0; f--) if (r[f].start < g - 1 && r[f].end >= g - 1) {
        p = !0, k = r[f], v = r[f - 1];
        break;
      }
      if (p) if (g === k.end && h >= k.durationMinutes) s += k.durationMinutes, a = this.$gantt.date.add(a, -k.durationMinutes, "minute");
      else if (!i && h <= g / 60 - k.startMinute) s += h, a = this.$gantt.date.add(a, -h, "minute");
      else if (i) h <= g / 60 - k.startMinute ? (s += h, a = this.$gantt.date.add(a, -h, "minute")) : (s += g / 60 - k.startMinute, a = v ? new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, v.end) : this.$gantt.date.day_start(a));
      else {
        var y = this._getMinutesPerHour(a);
        y <= h ? (s += y, a = this._nextDate(a, "hour", t)) : (o = this._subtractMinutesUntilHourStart(a, h), s += o.added, a = o.end);
      }
      else if (a.getHours() === 0 && a.getMinutes() === 0 && a.getSeconds() === 0) {
        if ((m = this._getClosestWorkTimePast(a, "hour")).valueOf() === a.valueOf()) {
          var m = this.$gantt.date.add(a, -1, "day"), S = this._getWorkHours(m);
          if (S.length) {
            var C = S[S.length - 1];
            m.setSeconds(C.durationSeconds);
          }
        }
        a = m;
      } else a = this._getClosestWorkTimePast(new Date(a - 1), "hour");
    }
    else a = this.$gantt.date.add(a, -1, "day");
  }
  if (s < n) {
    var b = n - s;
    o = this._subtractMinutesUntilHourStart(a, b), s += o.added, a = o.end;
  }
  return a;
}, _calculateMinuteEndDate: function(e, n, t) {
  var a = new Date(e), s = 0;
  t = t || 1, n = Math.abs(1 * n), n = Math.round(n);
  var i = this._addMinutesUntilHourEnd(a, n);
  s += i.added, a = i.end;
  for (var o = 0, l = [], r = 0, d = this._isMinutePrecision(a); s < n; ) {
    var c = this.$gantt.date.day_start(new Date(a)).valueOf();
    c !== o && (l = this._getWorkHours(a), r = this._getMinutesPerDay(a), o = c);
    var u = n - s, _ = this._getTimeOfDayStamp(a);
    if (l.length && r) if (l[0].start >= _ && u >= r) {
      if (s += r, u == r) {
        a = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, l[l.length - 1].end);
        break;
      }
      a = this.$gantt.date.add(a, 1, "day"), a = this.$gantt.date.day_start(a);
    } else {
      for (var h = !1, g = null, p = 0; p < l.length; p++) if (l[p].start <= _ && l[p].end > _) {
        h = !0, g = l[p];
        break;
      }
      if (h) if (_ === g.start && u >= g.durationMinutes) s += g.durationMinutes, a = this.$gantt.date.add(a, g.durationMinutes, "minute");
      else if (u <= g.endMinute - _ / 60) s += u, a = this.$gantt.date.add(a, u, "minute");
      else {
        var k = this._getMinutesPerHour(a);
        k <= u ? (s += k, a = d ? this.$gantt.date.add(a, k, "minute") : this._nextDate(a, "hour", t)) : (s += (i = this._addMinutesUntilHourEnd(a, u)).added, a = i.end);
      }
      else a = this._getClosestWorkTimeFuture(a, "hour");
    }
    else a = this.$gantt.date.add(this.$gantt.date.day_start(a), 1, "day");
  }
  if (s < n) {
    var v = n - s;
    s += (i = this._addMinutesUntilHourEnd(a, v)).added, a = i.end;
  }
  return a;
}, getClosestWorkTime: function() {
  var e = this.argumentsHelper.getClosestWorkTimeArguments.apply(this.argumentsHelper, arguments);
  return this._getClosestWorkTime(e.date, e.unit, e.dir);
}, _getClosestWorkTime: function(e, n, t) {
  var a = new Date(e);
  if (this._isWorkTime(a, n)) return a;
  if (a = this.$gantt.date[n + "_start"](a), t != "any" && t) a = t == "past" ? this._getClosestWorkTimePast(a, n) : this._getClosestWorkTimeFuture(a, n);
  else {
    var s = this._getClosestWorkTimeFuture(a, n), i = this._getClosestWorkTimePast(a, n);
    a = Math.abs(s - e) <= Math.abs(e - i) ? s : i;
  }
  return a;
}, _getClosestWorkTimeFuture: function(e, n) {
  return this._getClosestWorkTimeGeneric(e, n, 1);
}, _getClosestWorkTimePast: function(e, n) {
  var t = this._getClosestWorkTimeGeneric(e, n, -1);
  return this.$gantt.date.add(t, 1, n);
}, _findClosestTimeInDay: function(e, n, t) {
  var a = new Date(e), s = null, i = !1;
  this._getWorkHours(a).length || (a = this._getClosestWorkTime(a, "day", n < 0 ? "past" : "future"), n < 0 && (a = new Date(a.valueOf() - 1), i = !0), t = this._getWorkHours(a));
  var o = this._getTimeOfDayStamp(a);
  if (i && (o = this._getTimeOfDayStamp(new Date(a.valueOf() + 1), i)), n > 0) {
    for (var l = 0; l < t.length; l++) if (t[l].start >= o) {
      s = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, t[l].start);
      break;
    }
  } else for (l = t.length - 1; l >= 0; l--) {
    if (t[l].end <= o) {
      s = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, t[l].end);
      break;
    }
    if (t[l].end > o && t[l].start <= o) {
      s = new Date(a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, o);
      break;
    }
  }
  return s;
}, _getClosestWorkMinute: function(e, n, t) {
  var a = new Date(e), s = this._getWorkHours(a), i = this._findClosestTimeInDay(a, t, s);
  return i || (t > 0 ? (a = this.calculateEndDate(a, t, n), a = this.$gantt.date.day_start(a)) : (a = this.calculateEndDate(a, t, "day"), a = this.$gantt.date.day_start(a), a = this.$gantt.date.add(a, 1, "day"), a = new Date(a.valueOf() - 1)), s = this._getWorkHours(a), i = this._findClosestTimeInDay(a, t, s)), t < 0 && (i = this.$gantt.date.add(i, -1, n)), i;
}, _getClosestWorkTimeGeneric: function(e, n, t) {
  if (n === "hour" || n === "minute") return this._getClosestWorkMinute(e, n, t);
  for (var a = this._getUnitOrder(n), s = this.units[a - 1], i = e, o = 0; !this._isWorkTime(i, n) && (!s || this._isWorkTime(i, s) || (i = t > 0 ? this._getClosestWorkTimeFuture(i, s) : this._getClosestWorkTimePast(i, s), !this._isWorkTime(i, n))); ) {
    if (++o > 3e3) return this.$gantt.assert(!1, "Invalid working time check"), !1;
    var l = i.getTimezoneOffset();
    i = this.$gantt.date.add(i, t, n), i = this.$gantt._correct_dst_change(i, l, t, n), this.$gantt.date[n + "_start"] && (i = this.$gantt.date[n + "_start"](i));
  }
  return i;
}, hasWorkTime: function() {
  var e = this.getConfig(), n = e.dates;
  for (var t in e.dates) ;
  var a = this._checkWorkHours(e.hours), s = !1;
  return [0, 1, 2, 3, 4, 5, 6].forEach((function(i) {
    if (!s) {
      var o = n[i];
      o === !0 ? s = a : Array.isArray(o) && (s = this._checkWorkHours(o));
    }
  }).bind(this)), s;
}, _checkWorkHours: function(e) {
  if (e.length === 0) return !1;
  for (var n = !1, t = 0; t < e.length; t += 2) e[t] !== e[t + 1] && (n = !0);
  return n;
}, _isMinutePrecision: function(e) {
  let n = !1;
  return this._getWorkHours(e).forEach(function(t) {
    (t.startMinute % 60 || t.endMinute % 60) && (n = !0);
  }), n;
} };
const ae = { isLegacyResourceCalendarFormat: function(e) {
  if (!e) return !1;
  for (var n in e) if (e[n] && typeof e[n] == "object") return !0;
  return !1;
}, getResourceProperty: function(e) {
  var n = e.resource_calendars, t = e.resource_property;
  if (this.isLegacyResourceCalendarFormat(n)) for (var a in e) {
    t = a;
    break;
  }
  return t;
}, getCalendarIdFromLegacyConfig: function(e, n) {
  if (n) for (var t in n) {
    var a = n[t];
    if (e[t]) {
      var s = a[e[t]];
      if (s) return s;
    }
  }
  return null;
} }, mn = (le = {}, { getCalendarIdFromMultipleResources: function(e, n) {
  var t = function(s) {
    return s.map(function(i) {
      return i && i.resource_id ? i.resource_id : i;
    }).sort().join("-");
  }(e);
  if (e.length) {
    if (e.length === 1) return n.getResourceCalendar(t).id;
    if (le[t]) return le[t].id;
    var a = function(s, i) {
      return i.mergeCalendars(s.map(function(o) {
        var l = o && o.resource_id ? o.resource_id : o;
        return i.getResourceCalendar(l);
      }));
    }(e, n);
    return le[t] = a, n.addCalendar(a);
  }
  return null;
} });
var le;
function ht(e) {
  this.$gantt = e, this._calendars = {}, this._legacyConfig = void 0, this.$gantt.attachEvent("onGanttReady", (function() {
    this.$gantt.config.resource_calendars && (this._isLegacyConfig = ae.isLegacyResourceCalendarFormat(this.$gantt.config.resource_calendars));
  }).bind(this)), this.$gantt.attachEvent("onBeforeGanttReady", (function() {
    this.createDefaultCalendars();
  }).bind(this)), this.$gantt.attachEvent("onBeforeGanttRender", (function() {
    this.createDefaultCalendars();
  }).bind(this));
}
function Le(e, n) {
  this.argumentsHelper = n, this.$gantt = e;
}
function gt(e) {
  this.$gantt = e.$gantt, this.argumentsHelper = ut(this.$gantt), this.calendarManager = e, this.$disabledCalendar = new Le(this.$gantt, this.argumentsHelper);
}
ht.prototype = { _calendars: {}, _convertWorkTimeSettings: function(e) {
  const n = e.days;
  if (typeof n != "object" || Array.isArray(n) || n === null) {
    if (n && !e.dates) {
      e.dates = e.dates || {};
      for (let t = 0; t < n.length; t++) e.dates[t] = n[t], n[t] instanceof Array || (e.dates[t] = !!n[t]);
    }
  } else {
    const t = {};
    if (n != null && n.weekdays) for (let a = 0; a < 7; a++) t[a] = n.weekdays[a];
    n != null && n.dates && Object.entries(n.dates).forEach(([a, s]) => {
      t[new Date(a).valueOf()] = s;
    }), Object.entries(t).forEach(([a, s]) => {
      s instanceof Array || (t[a] = !!s);
    }), e = { ...e, dates: t };
  }
  return delete e.days, e;
}, mergeCalendars: function() {
  var e = [], n = arguments;
  if (Array.isArray(n[0])) e = n[0].slice();
  else for (var t = 0; t < arguments.length; t++) e.push(arguments[t]);
  var a, s = new _t();
  return e.forEach((function(i) {
    a = a ? this._createCalendarFromConfig(s.merge(a, i)) : i;
  }).bind(this)), this.createCalendar(a);
}, _createCalendarFromConfig: function(e) {
  var n = new Me(this.$gantt, ut(this.$gantt));
  n.id = String(se());
  var t = this._convertWorkTimeSettings(e);
  if (t.customWeeks) for (var a in t.customWeeks) t.customWeeks[a] = this._convertWorkTimeSettings(t.customWeeks[a]);
  return n._setConfig(t), n;
}, createCalendar: function(e) {
  var n;
  return e || (e = {}), B(n = e.getConfig ? J(e.getConfig()) : e.worktime ? J(e.worktime) : J(e), J(this.defaults.fulltime.worktime)), this._createCalendarFromConfig(n);
}, getCalendar: function(e) {
  e = e || "global";
  var n = this._calendars[e];
  return n || (this.createDefaultCalendars(), n = this._calendars[e]), n;
}, getCalendars: function() {
  var e = [];
  for (var n in this._calendars) e.push(this.getCalendar(n));
  return e;
}, _getOwnCalendar: function(e) {
  var n = this.$gantt.config;
  if (e[n.calendar_property]) return this.getCalendar(e[n.calendar_property]);
  if (n.resource_calendars) {
    var t;
    if (t = this._legacyConfig === !1 ? n.resource_property : ae.getResourceProperty(n), Array.isArray(e[t]) && e[t].length) n.dynamic_resource_calendars ? a = mn.getCalendarIdFromMultipleResources(e[t], this) : s = this.getResourceCalendar(e[t]);
    else if (this._legacyConfig === void 0 && (this._legacyConfig = ae.isLegacyResourceCalendarFormat(n.resource_calendars)), this._legacyConfig) var a = ae.getCalendarIdFromLegacyConfig(e, n.resource_calendars);
    else if (t && e[t] && n.resource_calendars[e[t]]) var s = this.getResourceCalendar(e[t]);
    if (a && (s = this.getCalendar(a)), s) return s;
  }
  return null;
}, getResourceCalendar: function(e) {
  if (e == null) return this.getCalendar();
  var n = null;
  n = typeof e == "number" || typeof e == "string" ? e : e.id || e.key;
  var t = this.$gantt.config, a = t.resource_calendars, s = null;
  if (Array.isArray(e) && e.length === 1 && (n = typeof e[0] == "object" ? e[0].resource_id : e[0]), a) {
    if (this._legacyConfig === void 0 && (this._legacyConfig = ae.isLegacyResourceCalendarFormat(t.resource_calendars)), this._legacyConfig) {
      for (var i in a) if (a[i][n]) {
        s = a[i][n];
        break;
      }
    } else s = a[n];
    if (s) return this.getCalendar(s);
  }
  return this.getCalendar();
}, getTaskCalendar: function(e) {
  var n, t = this.$gantt;
  if (e == null) return this.getCalendar();
  if (!(n = typeof e != "number" && typeof e != "string" || !t.isTaskExists(e) ? e : t.getTask(e))) return this.getCalendar();
  var a = this._getOwnCalendar(n), s = !!t.getState().group_mode;
  if (!a && t.config.inherit_calendar && t.isTaskExists(n.parent)) {
    for (var i = n; t.isTaskExists(i.parent) && (i = t.getTask(i.parent), !t.isSummaryTask(i) || !(a = this._getOwnCalendar(i))); ) ;
    s && !a && e.$effective_calendar && (a = this.getCalendar(e.$effective_calendar));
  }
  return a || this.getCalendar();
}, addCalendar: function(e) {
  if (!this.isCalendar(e)) {
    var n = e.id;
    (e = this.createCalendar(e)).id = n;
  }
  if (e._tryChangeCalendarSettings(function() {
  })) {
    var t = this.$gantt.config;
    return e.id = e.id || se(), this._calendars[e.id] = e, t.worktimes || (t.worktimes = {}), t.worktimes[e.id] = e.getConfig(), e.id;
  }
  return this.$gantt.callEvent("onCalendarError", [{ message: "Invalid calendar settings, no worktime available" }, e]), null;
}, deleteCalendar: function(e) {
  var n = this.$gantt.config;
  return !!e && !!this._calendars[e] && (delete this._calendars[e], n.worktimes && n.worktimes[e] && delete n.worktimes[e], !0);
}, restoreConfigCalendars: function(e) {
  for (var n in e) if (!this._calendars[n]) {
    var t = e[n], a = this.createCalendar(t);
    a.id = n, this.addCalendar(a);
  }
}, defaults: { global: { id: "global", worktime: { hours: [8, 12, 13, 17], days: [0, 1, 1, 1, 1, 1, 0] } }, fulltime: { id: "fulltime", worktime: { hours: [0, 24], days: [1, 1, 1, 1, 1, 1, 1] } } }, createDefaultCalendars: function() {
  var e = this.$gantt.config;
  this.restoreConfigCalendars(this.defaults), this.restoreConfigCalendars(e.worktimes);
}, isCalendar: function(e) {
  return [e.isWorkTime, e.setWorkTime, e.getWorkHours, e.unsetWorkTime, e.getClosestWorkTime, e.calculateDuration, e.hasDuration, e.calculateEndDate].every(function(n) {
    return n instanceof Function;
  });
} }, Le.prototype = { getWorkHours: function() {
  return [0, 24];
}, setWorkTime: function() {
  return !0;
}, unsetWorkTime: function() {
  return !0;
}, isWorkTime: function() {
  return !0;
}, getClosestWorkTime: function(e) {
  return this.argumentsHelper.getClosestWorkTimeArguments.apply(this.argumentsHelper, arguments).date;
}, calculateDuration: function() {
  var e = this.argumentsHelper.getDurationArguments.apply(this.argumentsHelper, arguments), n = e.start_date, t = e.end_date, a = e.unit, s = e.step;
  return this._calculateDuration(n, t, a, s);
}, _calculateDuration: function(e, n, t, a) {
  var s = this.$gantt.date, i = { week: 6048e5, day: 864e5, hour: 36e5, minute: 6e4 }, o = 0;
  if (i[t]) o = Math.round((n - e) / (a * i[t]));
  else {
    for (var l = new Date(e), r = new Date(n); l.valueOf() < r.valueOf(); ) o += 1, l = s.add(l, a, t);
    l.valueOf() != n.valueOf() && (o += (r - l) / (s.add(l, a, t) - l));
  }
  return Math.round(o);
}, hasDuration: function() {
  var e = this.argumentsHelper.getDurationArguments.apply(this.argumentsHelper, arguments), n = e.start_date, t = e.end_date;
  return !!e.unit && (n = new Date(n), t = new Date(t), n.valueOf() < t.valueOf());
}, hasWorkTime: function() {
  return !0;
}, equals: function(e) {
  return e instanceof Le;
}, calculateEndDate: function() {
  var e = this.argumentsHelper.calculateEndDateArguments.apply(this.argumentsHelper, arguments), n = e.start_date, t = e.duration, a = e.unit, s = e.step;
  return this.$gantt.date.add(n, s * t, a);
} }, gt.prototype = { _getCalendar: function(e) {
  var n;
  if (this.$gantt.config.work_time) {
    var t = this.calendarManager;
    e.task ? n = t.getTaskCalendar(e.task) : e.id ? n = t.getTaskCalendar(e) : e.calendar && (n = e.calendar), n || (n = t.getTaskCalendar());
  } else n = this.$disabledCalendar;
  return n;
}, getWorkHours: function(e) {
  return e = this.argumentsHelper.getWorkHoursArguments.apply(this.argumentsHelper, arguments), this._getCalendar(e).getWorkHours(e.date);
}, setWorkTime: function(e, n) {
  return e = this.argumentsHelper.setWorkTimeArguments.apply(this.argumentsHelper, arguments), n || (n = this.calendarManager.getCalendar()), n.setWorkTime(e);
}, unsetWorkTime: function(e, n) {
  return e = this.argumentsHelper.unsetWorkTimeArguments.apply(this.argumentsHelper, arguments), n || (n = this.calendarManager.getCalendar()), n.unsetWorkTime(e);
}, isWorkTime: function(e, n, t, a) {
  var s = this.argumentsHelper.isWorkTimeArguments.apply(this.argumentsHelper, arguments);
  return (a = this._getCalendar(s)).isWorkTime(s);
}, getClosestWorkTime: function(e) {
  return e = this.argumentsHelper.getClosestWorkTimeArguments.apply(this.argumentsHelper, arguments), this._getCalendar(e).getClosestWorkTime(e);
}, calculateDuration: function() {
  var e = this.argumentsHelper.getDurationArguments.apply(this.argumentsHelper, arguments);
  return this._getCalendar(e).calculateDuration(e);
}, hasDuration: function() {
  var e = this.argumentsHelper.hasDurationArguments.apply(this.argumentsHelper, arguments);
  return this._getCalendar(e).hasDuration(e);
}, calculateEndDate: function(e) {
  return e = this.argumentsHelper.calculateEndDateArguments.apply(this.argumentsHelper, arguments), this._getCalendar(e).calculateEndDate(e);
} };
const kn = function(e, n) {
  return { getWorkHours: function(t) {
    return n.getWorkHours(t);
  }, setWorkTime: function(t) {
    return n.setWorkTime(t);
  }, unsetWorkTime: function(t) {
    n.unsetWorkTime(t);
  }, isWorkTime: function(t, a, s) {
    return n.isWorkTime(t, a, s);
  }, getClosestWorkTime: function(t) {
    return n.getClosestWorkTime(t);
  }, calculateDuration: function(t, a, s) {
    return n.calculateDuration(t, a, s);
  }, _hasDuration: function(t, a, s) {
    return n.hasDuration(t, a, s);
  }, calculateEndDate: function(t, a, s, i) {
    return n.calculateEndDate(t, a, s, i);
  }, mergeCalendars: O(e.mergeCalendars, e), createCalendar: O(e.createCalendar, e), addCalendar: O(e.addCalendar, e), getCalendar: O(e.getCalendar, e), getCalendars: O(e.getCalendars, e), getResourceCalendar: O(e.getResourceCalendar, e), getTaskCalendar: O(e.getTaskCalendar, e), deleteCalendar: O(e.deleteCalendar, e) };
};
function vn(e) {
  e.isUnscheduledTask = function(o) {
    return e.assert(o && o instanceof Object, "Invalid argument <b>task</b>=" + o + " of gantt.isUnscheduledTask. Task object was expected"), !!o.unscheduled || !o.start_date;
  }, e._isAllowedUnscheduledTask = function(o) {
    return !(!o.unscheduled || !e.config.show_unscheduled);
  }, e._isTaskInTimelineLimits = function(o) {
    var l = o.start_date ? o.start_date.valueOf() : null, r = o.end_date ? o.end_date.valueOf() : null;
    return !!(l && r && l <= this._max_date.valueOf() && r >= this._min_date.valueOf());
  }, e.isTaskVisible = function(o) {
    if (!this.isTaskExists(o)) return !1;
    var l = this.getTask(o);
    return !(!this._isAllowedUnscheduledTask(l) && !this._isTaskInTimelineLimits(l)) && this.getGlobalTaskIndex(o) >= 0;
  }, e._getProjectEnd = function() {
    if (e.config.project_end) return e.config.project_end;
    var o = e.getTaskByTime();
    return (o = o.sort(function(l, r) {
      return +l.end_date > +r.end_date ? 1 : -1;
    })).length ? o[o.length - 1].end_date : null;
  }, e._getProjectStart = function() {
    if (e.config.project_start) return e.config.project_start;
    if (e.config.start_date) return e.config.start_date;
    if (e.getState().min_date) return e.getState().min_date;
    var o = e.getTaskByTime();
    return (o = o.sort(function(l, r) {
      return +l.start_date > +r.start_date ? 1 : -1;
    })).length ? o[0].start_date : null;
  };
  var n = function(o, l) {
    var r = !!(l && l != e.config.root_id && e.isTaskExists(l)) && e.getTask(l), d = null;
    if (r) if (e._getAutoSchedulingConfig().schedule_from_end) d = e.calculateEndDate({ start_date: r.end_date, duration: -e.config.duration_step, task: o });
    else {
      if (!r.start_date) return n(r, e.getParent(r));
      d = r.start_date;
    }
    else if (e._getAutoSchedulingConfig().schedule_from_end) d = e.calculateEndDate({ start_date: e._getProjectEnd(), duration: -e.config.duration_step, task: o });
    else {
      const c = e.getTaskByIndex(0), u = e.config.start_date || e.getState().min_date;
      d = c ? c.start_date ? c.start_date : c.end_date ? e.calculateEndDate({ start_date: c.end_date, duration: -e.config.duration_step, task: o }) : u : u;
    }
    return e.assert(d, "Invalid dates"), new Date(d);
  };
  e._set_default_task_timing = function(o) {
    o.start_date = o.start_date || n(o, e.getParent(o)), o.duration = o.duration || e.config.duration_step, o.end_date = o.end_date || e.calculateEndDate(o);
  }, e.createTask = function(o, l, r) {
    if (o = o || {}, e.defined(o.id) || (o.id = e.uid()), o.start_date || (o.start_date = n(o, l)), o.text === void 0 && (o.text = e.locale.labels.new_task), o.duration === void 0 && (o.duration = 1), this.isTaskExists(l)) {
      this.setParent(o, l, !0);
      var d = this.getTask(l);
      d.$open = !0, this.config.details_on_create || this.callEvent("onAfterParentExpand", [l, d]);
    }
    return this.callEvent("onTaskCreated", [o]) ? (this.config.details_on_create ? (e.isTaskExists(o.id) ? e.getTask(o.id).$index != o.$index && (o.start_date && typeof o.start_date == "string" && (o.start_date = this.date.parseDate(o.start_date, "parse_date")), o.end_date && typeof o.end_date == "string" && (o.end_date = this.date.parseDate(o.end_date, "parse_date")), this.$data.tasksStore.updateItem(o.id, o)) : (o.$new = !0, this.silent(function() {
      e.$data.tasksStore.addItem(o, r);
    })), this.selectTask(o.id), this.refreshData(), this.showLightbox(o.id)) : this.addTask(o, l, r) && (this.showTask(o.id), this.selectTask(o.id)), o.id) : null;
  }, e._update_flags = function(o, l) {
    var r = e.$data.tasksStore;
    o === void 0 ? (this._lightbox_id = null, r.silent(function() {
      r.unselect();
    }), this.getSelectedTasks && this._multiselect.reset(), this._tasks_dnd && this._tasks_dnd.drag && (this._tasks_dnd.drag.id = null)) : (this._lightbox_id == o && (this._lightbox_id = l), r.getSelectedId() == o && r.silent(function() {
      r.unselect(o), r.select(l);
    }), this._tasks_dnd && this._tasks_dnd.drag && this._tasks_dnd.drag.id == o && (this._tasks_dnd.drag.id = l));
  };
  var t = function(o, l) {
    var r = e.getTaskType(o.type), d = { type: r, $no_start: !1, $no_end: !1, scheduled_summary: !1 };
    return r === e.config.types.project && o.auto_scheduling === !1 && (d.scheduled_summary = !0), l || r != o.$rendered_type ? (r == e.config.types.project ? d.$no_end = d.$no_start = !0 : r != e.config.types.milestone && (d.$no_end = !(o.end_date || o.duration), d.$no_start = !o.start_date, e._isAllowedUnscheduledTask(o) && (d.$no_end = d.$no_start = !1)), d) : (d.$no_start = o.$no_start, d.$no_end = o.$no_end, d);
  };
  function a(o) {
    o.$effective_calendar = e.getTaskCalendar(o).id, o.start_date = e.getClosestWorkTime({ dir: "future", date: o.start_date, unit: e.config.duration_unit, task: o }), o.end_date = e.calculateEndDate(o);
  }
  function s(o, l, r, d) {
    const c = { start: "start_date", end: "end_date" }, u = { start: "$auto_start_date", end: "$auto_end_date" };
    let _;
    _ = o.type === e.config.types.project && o.auto_scheduling === !1 ? u : c, l.$no_start && (o[_.start] = r ? new Date(r) : n(o, this.getParent(o))), l.$no_end && (o[_.end] = d ? new Date(d) : this.calculateEndDate({ start_date: o[_.start], duration: this.config.duration_step, task: o })), (l.$no_start || l.$no_end) && this._init_task_timing(o);
  }
  function i(o) {
    let l = null, r = null, d = o !== void 0 ? o : e.config.root_id;
    const c = [], u = [];
    let _ = null;
    return e.isTaskExists(d) && (_ = e.getTask(d)), e.eachTask(function(h) {
      const g = e.getTaskType(h.type) == e.config.types.project && h.auto_scheduling === !1;
      e.getTaskType(h.type) == e.config.types.project && !g || e.isUnscheduledTask(h) || (h.rollup && c.push(h.id), !h.start_date || h.$no_start && !g || l && !(l > h.start_date.valueOf()) || (l = h.start_date.valueOf()), !h.end_date || h.$no_end && !g || r && !(r < h.end_date.valueOf()) || (r = h.end_date.valueOf()), _ && _.render == "split" && (h.split_placement === "inline" ? u.push(h) : h.split_placement === "subrow" || _.$open && e.config.open_split_tasks || u.push(h)));
    }, d), { start_date: l ? new Date(l) : null, end_date: r ? new Date(r) : null, rollup: c, splitItems: u };
  }
  e._init_task_timing = function(o) {
    var l = t(o, !0), r = o.$rendered_type != l.type, d = l.type;
    r && (o.$no_start = l.$no_start, o.$no_end = l.$no_end, o.$rendered_type = l.type), r && d != this.config.types.milestone && d == this.config.types.project && (this._set_default_task_timing(o), o.$calculate_duration = !1), d == this.config.types.milestone && (o.end_date = o.start_date), o.start_date && o.end_date && o.$calculate_duration !== !1 && (o.duration = this.calculateDuration(o)), o.$calculate_duration || (o.$calculate_duration = !0), o.end_date || (o.end_date = o.start_date), o.duration = o.duration || 0, this.config.min_duration === 0 && o.duration === 0 && (o.$no_end = !1, o.type === e.config.types.project && e.hasChild(o.id) && (o.$no_end = !0));
    var c = this.getTaskCalendar(o);
    o.$effective_calendar && o.$effective_calendar !== c.id && (a(o), this.config.inherit_calendar && this.isSummaryTask(o) && this.eachTask(function(u) {
      a(u);
    }, o.id)), o.$effective_calendar = c.id;
  }, e.isSummaryTask = function(o) {
    e.assert(o && o instanceof Object, "Invalid argument <b>task</b>=" + o + " of gantt.isSummaryTask. Task object was expected");
    var l = t(o);
    return !(!l.$no_end && !l.$no_start);
  }, e.resetProjectDates = function(o) {
    var l = t(o);
    if (l.$no_end || l.$no_start) {
      var r = i(o.id);
      s.call(this, o, l, r.start_date, r.end_date), o.$rollup = r.rollup, o.$inlineSplit = r.splitItems;
    }
  }, e.getSubtaskDuration = function(o) {
    var l = 0, r = o !== void 0 ? o : e.config.root_id;
    return this.eachTask(function(d) {
      this.getTaskType(d.type) == e.config.types.project || this.isUnscheduledTask(d) || (l += d.duration);
    }, r), l;
  }, e.getSubtaskDates = function(o) {
    var l = i(o);
    return { start_date: l.start_date, end_date: l.end_date };
  }, e._update_parents = function(o, l, r) {
    if (o) {
      var d = this.getTask(o);
      d.rollup && (r = !0);
      var c = this.getParent(d), u = t(d), _ = !0;
      if (r || d.start_date && d.end_date && (u.$no_start || u.$no_end)) {
        const p = d.$auto_start_date ? "$auto_start_date" : "start_date", k = d.$auto_end_date ? "$auto_end_date" : "end_date";
        var h = d[p].valueOf(), g = d[k].valueOf();
        e.resetProjectDates(d), r || h != d[p].valueOf() || g != d[k].valueOf() || (_ = !1), _ && !l && this.refreshTask(d.id, !0), u.scheduled_summary && (_ = !0);
      }
      _ && c && this.isTaskExists(c) && this._update_parents(c, l, r);
    }
  }, e.roundDate = function(o) {
    var l = e.getScale();
    G(o) && (o = { date: o, unit: l ? l.unit : e.config.duration_unit, step: l ? l.step : e.config.duration_step });
    var r, d, c, u = o.date, _ = o.step, h = o.unit;
    if (!l) return u;
    if (h == l.unit && _ == l.step && +u >= +l.min_date && +u <= +l.max_date) c = Math.floor(e.columnIndexByDate(u)), l.trace_x[c] || (c -= 1, l.rtl && (c = 0)), d = new Date(l.trace_x[c]), r = e.date.add(d, _, h);
    else {
      for (c = Math.floor(e.columnIndexByDate(u)), r = e.date[h + "_start"](new Date(l.min_date)), l.trace_x[c] && (r = e.date[h + "_start"](l.trace_x[c])); +r < +u; ) {
        var g = (r = e.date[h + "_start"](e.date.add(r, _, h))).getTimezoneOffset();
        r = e._correct_dst_change(r, g, r, h), e.date[h + "_start"] && (r = e.date[h + "_start"](r));
      }
      d = e.date.add(r, -1 * _, h);
    }
    return o.dir && o.dir == "future" ? r : o.dir && o.dir == "past" || Math.abs(u - d) < Math.abs(r - u) ? d : r;
  }, e.correctTaskWorkTime = function(o) {
    e.config.work_time && e.config.correct_work_time && (this.isWorkTime(o.start_date, void 0, o) ? this.isWorkTime(new Date(+o.end_date - 1), void 0, o) || (o.end_date = this.calculateEndDate(o)) : (o.start_date = this.getClosestWorkTime({ date: o.start_date, dir: "future", task: o }), o.end_date = this.calculateEndDate(o)));
  }, e.attachEvent("onBeforeTaskUpdate", function(o, l) {
    return e._init_task_timing(l), !0;
  }), e.attachEvent("onBeforeTaskAdd", function(o, l) {
    return e._init_task_timing(l), !0;
  }), e.attachEvent("onAfterTaskMove", function(o, l, r) {
    return e._init_task_timing(e.getTask(o)), !0;
  });
}
function Qe(e, n) {
  var t, a = e.config.container_resize_timeout || 20;
  let s = et(e);
  if (e.config.container_resize_method == "timeout") r();
  else try {
    e.event(n, "resize", function() {
      if (e.$scrollbarRepaint) e.$scrollbarRepaint = null;
      else {
        let d = et(e);
        if (s.x == d.x && s.y == d.y) return;
        s = d, i();
      }
    });
  } catch {
    r();
  }
  function i() {
    clearTimeout(t), t = setTimeout(function() {
      e.$destroyed || e.render();
    }, a);
  }
  var o = e.$root.offsetHeight, l = e.$root.offsetWidth;
  function r() {
    e.$root.offsetHeight == o && e.$root.offsetWidth == l || i(), o = e.$root.offsetHeight, l = e.$root.offsetWidth, setTimeout(r, a);
  }
}
function et(e) {
  return { x: e.$root.offsetWidth, y: e.$root.offsetHeight };
}
function yn(e) {
  e.assert = /* @__PURE__ */ function(i) {
    return function(o, l) {
      o || i.config.show_errors && i.callEvent("onError", [l]) !== !1 && (i.message ? i.message({ type: "error", text: l, expire: -1 }) : console.log(l));
    };
  }(e);
  var n = "Invalid value of the first argument of `gantt.init`. Supported values: HTMLElement, String (element id).This error means that either invalid object is passed into `gantt.init` or that the element with the specified ID doesn't exist on the page when `gantt.init` is called.";
  function t(i) {
    if (!i || typeof i == "string" && document.getElementById(i) || function(o) {
      try {
        o.cloneNode(!1);
      } catch {
        return !1;
      }
      return !0;
    }(i)) return !0;
    throw e.assert(!1, n), new Error(n);
  }
  e.init = function(i, o, l) {
    e.env.isNode ? i = null : t(i), o && l && (this.config.start_date = this._min_date = new Date(o), this.config.end_date = this._max_date = new Date(l)), this.date.init(), this.init = function(r) {
      e.env.isNode ? r = null : t(r), this.$container && this.$container.parentNode && (this.$container.parentNode.removeChild(this.$container), this.$container = null), this.$layout && this.$layout.clear(), this._reinit(r);
    }, this._reinit(i);
  }, e._quickRefresh = function(i) {
    for (var o = this._getDatastores.call(this), l = 0; l < o.length; l++) o[l]._quick_refresh = !0;
    for (i(), l = 0; l < o.length; l++) o[l]._quick_refresh = !1;
  };
  var a = (function() {
    this._clearTaskLayers && this._clearTaskLayers(), this._clearLinkLayers && this._clearLinkLayers(), this.$layout && (this.$layout.destructor(), this.$layout = null, this.$ui.reset());
  }).bind(e), s = (function() {
    H(e) || (this.$root.innerHTML = "", this.$root.gantt = this, Ce(this), this.config.layout.id = "main", this.$layout = this.$ui.createView("layout", this.$root, this.config.layout), this.$layout.attachEvent("onBeforeResize", function() {
      for (var i = e.$services.getService("datastores"), o = 0; o < i.length; o++) e.getDatastore(i[o]).filter(), e.$data.tasksStore._skipTaskRecalculation ? e.$data.tasksStore._skipTaskRecalculation != "lightbox" && (e.$data.tasksStore._skipTaskRecalculation = !1) : e.getDatastore(i[o]).callEvent("onBeforeRefreshAll", []);
    }), this.$layout.attachEvent("onResize", function() {
      e._quickRefresh(function() {
        e.refreshData();
      });
    }), this.callEvent("onGanttLayoutReady", []), this.$layout.render(), this.$container = this.$layout.$container.firstChild, function(i) {
      window.getComputedStyle(i.$root).getPropertyValue("position") == "static" && (i.$root.style.position = "relative");
      var o = document.createElement("iframe");
      o.className = "gantt_container_resize_watcher", o.tabIndex = -1, i.config.wai_aria_attributes && (o.setAttribute("role", "none"), o.setAttribute("aria-hidden", !0)), i.env.isSalesforce && (i.config.container_resize_method = "timeout"), i.$root.appendChild(o), o.contentWindow ? Qe(i, o.contentWindow) : (i.$root.removeChild(o), Qe(i, window));
    }(this));
  }).bind(e);
  e.resetLayout = function() {
    a(), s(), this.render();
  }, e._reinit = function(i) {
    this.callEvent("onBeforeGanttReady", []), this._update_flags(), this.$services.getService("templateLoader").initTemplates(this), a(), this.$root = null, i && (this.$root = function(o) {
      return typeof o == "string" ? document.getElementById(o) || document.querySelector(o) || document.body : o || document.body;
    }(i), s(), this.$mouseEvents.reset(this.$root), function(o) {
      o.$container && !o.config.autosize && o.$root.offsetHeight < 50 && console.warn(`The Gantt container has a small height, so you cannot see its content. If it is not intended, you need to set the 'height' style rule to the container:
https://docs.dhtmlx.com/gantt/faq.html#theganttchartisntrenderedcorrectly`);
    }(e)), this.callEvent("onTemplatesReady", []), this.callEvent("onGanttReady", []), this.render();
  }, e.$click = { buttons: { edit: function(i) {
    e.isReadonly(e.getTask(i)) || e.showLightbox(i);
  }, delete: function(i) {
    var o = e.getTask(i);
    if (!e.isReadonly(o)) {
      var l = e.locale.labels.confirm_deleting, r = e.locale.labels.confirm_deleting_title;
      e._delete_task_confirm({ task: o, message: l, title: r, callback: function() {
        e.isTaskExists(i) && (o.$new ? (e.$data.tasksStore._skipTaskRecalculation = "lightbox", e.silent(function() {
          e.deleteTask(i, !0);
        }), e.$data.tasksStore._skipTaskRecalculation = !1, e.refreshData()) : (e.$data.tasksStore._skipTaskRecalculation = !0, e.deleteTask(i))), e.hideLightbox();
      } });
    }
  } } }, e.render = function() {
    var i;
    if (this.callEvent("onBeforeGanttRender", []), !H(e)) {
      !this.config.sort && this._sort && (this._sort = void 0), this.$root && (this.config.rtl ? (this.$root.classList.add("gantt_rtl"), this.$root.firstChild.classList.add("gantt_rtl")) : (this.$root.classList.remove("gantt_rtl"), this.$root.firstChild.classList.remove("gantt_rtl")));
      var o = this.getScrollState(), l = o ? o.x : 0;
      this._getHorizontalScrollbar() && (l = this._getHorizontalScrollbar().$config.codeScrollLeft || l || 0), i = null, l && (i = e.dateFromPos(l + this.config.task_scroll_offset));
    }
    if (Ce(this), H(e)) e.refreshData();
    else {
      this.$layout.$config.autosize = this.config.autosize;
      var r = this.config.preserve_scroll;
      if (this.config.preserve_scroll = !1, this.$layout.resize(), this.config.preserve_scroll = r, this.config.preserve_scroll && o) {
        const u = e.ext.zoom._initialized;
        if ((l || o.y) && !u) {
          var d = e.getScrollState();
          if (+i != +e.dateFromPos(d.x) || d.y != o.y) {
            l = null;
            var c = null;
            i && (l = Math.max(e.posFromDate(i) - e.config.task_scroll_offset, 0)), o.y && (c = o.y), e.scrollTo(l, c);
          }
        }
        this.$layout.getScrollbarsInfo().forEach((_) => {
          const h = e.$ui.getView(_.id), g = e.utils.dom.isChildOf(h.$view, e.$container);
          _.boundViews.forEach((p) => {
            const k = e.$ui.getView(p);
            _.y && _.y != o.y && k && !g && k.scrollTo(void 0, 0), _.x_pos && _.x_pos != o.x && k && g && k.scrollTo(_.x_pos, void 0);
          });
        });
      }
    }
    this.callEvent("onGanttRender", []);
  }, e.setSizes = e.render, e.getTaskRowNode = function(i) {
    for (var o = this.$grid_data.childNodes, l = this.config.task_attribute, r = 0; r < o.length; r++)
      if (o[r].getAttribute && o[r].getAttribute(l) == i) return o[r];
    return null;
  }, e.changeLightboxType = function(i) {
    if (this.getLightboxType() == i) return !0;
    e._silent_redraw_lightbox(i);
  }, e._get_link_type = function(i, o) {
    var l = null;
    return i && o ? l = e.config.links.start_to_start : !i && o ? l = e.config.links.finish_to_start : i || o ? i && !o && (l = e.config.links.start_to_finish) : l = e.config.links.finish_to_finish, l;
  }, e.isLinkAllowed = function(i, o, l, r) {
    var d = null;
    if (!(d = typeof i == "object" ? i : { source: i, target: o, type: this._get_link_type(l, r) }) || !(d.source && d.target && d.type) || d.source == d.target) return !1;
    var c = !0;
    return this.checkEvent("onLinkValidation") && (c = this.callEvent("onLinkValidation", [d])), c;
  }, e._correct_dst_change = function(i, o, l, r) {
    var d = function(u) {
      return je[u] || je.hour;
    }(r) * l;
    if (d > 3600 && d < 86400) {
      var c = i.getTimezoneOffset() - o;
      c && (i = e.date.add(i, c, "minute"));
    }
    return i;
  }, e.isSplitTask = function(i) {
    return e.assert(i && i instanceof Object, "Invalid argument <b>task</b>=" + i + " of gantt.isSplitTask. Task object was expected"), this.$data.tasksStore._isSplitItem(i);
  }, e._is_icon_open_click = function(i) {
    if (!i) return !1;
    var o = i.target || i.srcElement;
    if (!o || !o.className) return !1;
    var l = Lt(o);
    return l.indexOf("gantt_tree_icon") !== -1 && (l.indexOf("gantt_close") !== -1 || l.indexOf("gantt_open") !== -1);
  };
}
const bn = { date: { month_full: ["كانون الثاني", "شباط", "آذار", "نيسان", "أيار", "حزيران", "تموز", "آب", "أيلول", "تشرين الأول", "تشرين الثاني", "كانون الأول"], month_short: ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"], day_full: ["الأحد", "الأثنين", "ألثلاثاء", "الأربعاء", "ألحميس", "ألجمعة", "السبت"], day_short: ["احد", "اثنين", "ثلاثاء", "اربعاء", "خميس", "جمعة", "سبت"] }, labels: { new_task: "مهمة جديد", icon_save: "اخزن", icon_cancel: "الغاء", icon_details: "تفاصيل", icon_edit: "تحرير", icon_delete: "حذف", confirm_closing: "التغييرات سوف تضيع, هل انت متأكد؟", confirm_deleting: "الحدث سيتم حذفها نهائيا ، هل أنت متأكد؟", section_description: "الوصف", section_time: "الفترة الزمنية", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "الغاء", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Sn = { date: { month_full: ["Студзень", "Люты", "Сакавік", "Красавік", "Maй", "Чэрвень", "Ліпень", "Жнівень", "Верасень", "Кастрычнік", "Лістапад", "Снежань"], month_short: ["Студз", "Лют", "Сак", "Крас", "Maй", "Чэр", "Ліп", "Жнів", "Вер", "Каст", "Ліст", "Снеж"], day_full: ["Нядзеля", "Панядзелак", "Аўторак", "Серада", "Чацвер", "Пятніца", "Субота"], day_short: ["Нд", "Пн", "Аўт", "Ср", "Чцв", "Пт", "Сб"] }, labels: { new_task: "Новае заданне", icon_save: "Захаваць", icon_cancel: "Адмяніць", icon_details: "Дэталі", icon_edit: "Змяніць", icon_delete: "Выдаліць", confirm_closing: "", confirm_deleting: "Падзея будзе выдалена незваротна, працягнуць?", section_description: "Апісанне", section_time: "Перыяд часу", section_type: "Тып", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "ІСР", column_text: "Задача", column_start_date: "Пачатак", column_duration: "Працяг", column_add: "", link: "Сувязь", confirm_link_deleting: "будзе выдалена", link_start: "(пачатак)", link_end: "(канец)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Хвiлiна", hours: "Гадзiна", days: "Дзень", weeks: "Тыдзень", months: "Месяц", years: "Год", message_ok: "OK", message_cancel: "Адмяніць", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Tn = { date: { month_full: ["Gener", "Febrer", "Març", "Abril", "Maig", "Juny", "Juliol", "Agost", "Setembre", "Octubre", "Novembre", "Desembre"], month_short: ["Gen", "Feb", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Oct", "Nov", "Des"], day_full: ["Diumenge", "Dilluns", "Dimarts", "Dimecres", "Dijous", "Divendres", "Dissabte"], day_short: ["Dg", "Dl", "Dm", "Dc", "Dj", "Dv", "Ds"] }, labels: { new_task: "Nova tasca", icon_save: "Guardar", icon_cancel: "Cancel·lar", icon_details: "Detalls", icon_edit: "Editar", icon_delete: "Esborrar", confirm_closing: "", confirm_deleting: "L'esdeveniment s'esborrarà definitivament, continuar ?", section_description: "Descripció", section_time: "Periode de temps", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Cancel·lar", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, xn = { date: { month_full: ["一月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"], month_short: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"], day_full: ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"], day_short: ["日", "一", "二", "三", "四", "五", "六"] }, labels: { new_task: "新任務", icon_save: "保存", icon_cancel: "关闭", icon_details: "详细", icon_edit: "编辑", icon_delete: "删除", confirm_closing: "请确认是否撤销修改!", confirm_deleting: "是否删除日程?", section_description: "描述", section_time: "时间范围", section_type: "类型", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "工作分解结构", column_text: "任务名", column_start_date: "开始时间", column_duration: "持续时间", column_add: "", link: "关联", confirm_link_deleting: "将被删除", link_start: " (开始)", link_end: " (结束)", type_task: "任务", type_project: "项目", type_milestone: "里程碑", minutes: "分钟", hours: "小时", days: "天", weeks: "周", months: "月", years: "年", message_ok: "OK", message_cancel: "关闭", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, wn = { date: { month_full: ["Leden", "Únor", "Březen", "Duben", "Květen", "Červen", "Červenec", "Srpen", "Září", "Říjen", "Listopad", "Prosinec"], month_short: ["Led", "Ún", "Bře", "Dub", "Kvě", "Čer", "Čec", "Srp", "Září", "Říj", "List", "Pro"], day_full: ["Neděle", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota"], day_short: ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"] }, labels: { new_task: "Nová práce", icon_save: "Uložit", icon_cancel: "Zpět", icon_details: "Detail", icon_edit: "Edituj", icon_delete: "Smazat", confirm_closing: "", confirm_deleting: "Událost bude trvale smazána, opravdu?", section_description: "Poznámky", section_time: "Doba platnosti", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Zpět", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Cn = { date: { month_full: ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"], month_short: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"], day_full: ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"], day_short: ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"] }, labels: { new_task: "Ny opgave", icon_save: "Gem", icon_cancel: "Fortryd", icon_details: "Detaljer", icon_edit: "Tilret", icon_delete: "Slet", confirm_closing: "Dine rettelser vil gå tabt.. Er dy sikker?", confirm_deleting: "Bigivenheden vil blive slettet permanent. Er du sikker?", section_description: "Beskrivelse", section_time: "Tidsperiode", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Fortryd", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, En = { date: { month_full: [" Januar", " Februar", " März ", " April", " Mai", " Juni", " Juli", " August", " September ", " Oktober", " November ", " Dezember"], month_short: ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"], day_full: ["Sonntag", "Montag", "Dienstag", " Mittwoch", " Donnerstag", "Freitag", "Samstag"], day_short: ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"] }, labels: { new_task: "Neue Aufgabe", icon_save: "Speichern", icon_cancel: "Abbrechen", icon_details: "Details", icon_edit: "Ändern", icon_delete: "Löschen", confirm_closing: "", confirm_deleting: "Der Eintrag wird gelöscht", section_description: "Beschreibung", section_time: "Zeitspanne", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "PSP", column_text: "Task-Namen", column_start_date: "Startzeit", column_duration: "Dauer", column_add: "", link: "Link", confirm_link_deleting: "werden gelöscht", link_start: "(starten)", link_end: "(ende)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minuten", hours: "Stunden", days: "Tage", weeks: "Wochen", months: "Monate", years: "Jahre", message_ok: "OK", message_cancel: "Abbrechen", section_constraint: "Regel", constraint_type: "Regel", constraint_date: "Regel - Datum", asap: "So bald wie möglich", alap: "So spät wie möglich", snet: "Beginn nicht vor", snlt: "Beginn nicht später als", fnet: "Fertigstellung nicht vor", fnlt: "Fertigstellung nicht später als", mso: "Muss beginnen am", mfo: "Muss fertig sein am", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, $n = { date: { month_full: ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάϊος", "Ιούνιος", "Ιούλιος", "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"], month_short: ["ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΙ", "ΙΟΥΝ", "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ"], day_full: ["Κυριακή", "Δευτέρα", "Τρίτη", "Τετάρτη", "Πέμπτη", "Παρασκευή", "Κυριακή"], day_short: ["ΚΥ", "ΔΕ", "ΤΡ", "ΤΕ", "ΠΕ", "ΠΑ", "ΣΑ"] }, labels: { new_task: "Νέα εργασία", icon_save: "Αποθήκευση", icon_cancel: "Άκυρο", icon_details: "Λεπτομέρειες", icon_edit: "Επεξεργασία", icon_delete: "Διαγραφή", confirm_closing: "", confirm_deleting: "Το έργο θα διαγραφεί οριστικά. Θέλετε να συνεχίσετε;", section_description: "Περιγραφή", section_time: "Χρονική περίοδος", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Άκυρο", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, An = { date: { month_full: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], month_short: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], day_full: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"], day_short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] }, labels: { new_task: "New task", icon_save: "Save", icon_cancel: "Cancel", icon_details: "Details", icon_edit: "Edit", icon_delete: "Delete", confirm_closing: "", confirm_deleting: "Task will be deleted permanently, are you sure?", section_description: "Description", section_time: "Time period", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Cancel", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Dn = { date: { month_full: ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"], month_short: ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"], day_full: ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"], day_short: ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"] }, labels: { new_task: "Nueva tarea", icon_save: "Guardar", icon_cancel: "Cancelar", icon_details: "Detalles", icon_edit: "Editar", icon_delete: "Eliminar", confirm_closing: "", confirm_deleting: "El evento se borrará definitivamente, ¿continuar?", section_description: "Descripción", section_time: "Período", section_type: "Tipo", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "EDT", column_text: "Tarea", column_start_date: "Inicio", column_duration: "Duración", column_add: "", link: "Enlace", confirm_link_deleting: "será borrada", link_start: " (inicio)", link_end: " (fin)", type_task: "Tarea", type_project: "Proyecto", type_milestone: "Hito", minutes: "Minutos", hours: "Horas", days: "Días", weeks: "Semanas", months: "Meses", years: "Años", message_ok: "OK", message_cancel: "Cancelar", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Mn = { date: { month_full: ["ژانویه", "فوریه", "مارس", "آوریل", "مه", "ژوئن", "ژوئیه", "اوت", "سپتامبر", "اکتبر", "نوامبر", "دسامبر"], month_short: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"], day_full: ["يکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"], day_short: ["ی", "د", "س", "چ", "پ", "ج", "ش"] }, labels: { new_task: "وظیفه جدید", icon_save: "ذخیره", icon_cancel: "لغو", icon_details: "جزییات", icon_edit: "ویرایش", icon_delete: "حذف", confirm_closing: "تغییرات شما ازدست خواهد رفت، آیا مطمئن هستید؟", confirm_deleting: "این مورد برای همیشه حذف خواهد شد، آیا مطمئن هستید؟", section_description: "توضیحات", section_time: "مدت زمان", section_type: "نوع", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "عنوان", column_start_date: "زمان شروع", column_duration: "مدت", column_add: "", link: "ارتباط", confirm_link_deleting: "حذف خواهد شد", link_start: " (آغاز)", link_end: " (پایان)", type_task: "وظیفه", type_project: "پروژه", type_milestone: "نگارش", minutes: "دقایق", hours: "ساعات", days: "روزها", weeks: "هفته", months: "ماه‌ها", years: "سال‌ها", message_ok: "تایید", message_cancel: "لغو", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Ln = { date: { month_full: ["Tammikuu", "Helmikuu", "Maaliskuu", "Huhtikuu", "Toukokuu", "Kes&auml;kuu", "Hein&auml;kuu", "Elokuu", "Syyskuu", "Lokakuu", "Marraskuu", "Joulukuu"], month_short: ["Tam", "Hel", "Maa", "Huh", "Tou", "Kes", "Hei", "Elo", "Syy", "Lok", "Mar", "Jou"], day_full: ["Sunnuntai", "Maanantai", "Tiistai", "Keskiviikko", "Torstai", "Perjantai", "Lauantai"], day_short: ["Su", "Ma", "Ti", "Ke", "To", "Pe", "La"] }, labels: { new_task: "Uusi tehtävä", icon_save: "Tallenna", icon_cancel: "Peru", icon_details: "Tiedot", icon_edit: "Muokkaa", icon_delete: "Poista", confirm_closing: "", confirm_deleting: "Haluatko varmasti poistaa tapahtuman?", section_description: "Kuvaus", section_time: "Aikajakso", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Peru", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, In = { date: { month_full: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"], month_short: ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Aoû", "Sep", "Oct", "Nov", "Déc"], day_full: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"], day_short: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"] }, labels: { new_task: "Nouvelle tâche", icon_save: "Enregistrer", icon_cancel: "Annuler", icon_details: "Détails", icon_edit: "Modifier", icon_delete: "Effacer", confirm_closing: "", confirm_deleting: "L'événement sera effacé sans appel, êtes-vous sûr ?", section_description: "Description", section_time: "Période", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "OTP", column_text: "Nom de la tâche", column_start_date: "Date initiale", column_duration: "Durée", column_add: "", link: "Le lien", confirm_link_deleting: "sera supprimé", link_start: "(début)", link_end: "(fin)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Heures", days: "Jours", weeks: "Semaines", months: "Mois", years: "Années", message_ok: "OK", message_cancel: "Annuler", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, On = { date: { month_full: ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"], month_short: ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"], day_full: ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"], day_short: ["א", "ב", "ג", "ד", "ה", "ו", "ש"] }, labels: { new_task: "משימה חדש", icon_save: "שמור", icon_cancel: "בטל", icon_details: "פרטים", icon_edit: "ערוך", icon_delete: "מחק", confirm_closing: "", confirm_deleting: "ארוע ימחק סופית.להמשיך?", section_description: "הסבר", section_time: "תקופה", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "בטל", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Pn = { date: { month_full: ["Siječanj", "Veljača", "Ožujak", "Travanj", "Svibanj", "Lipanj", "Srpanj", "Kolovoz", "Rujan", "Listopad", "Studeni", "Prosinac"], month_short: ["Sij", "Velj", "Ožu", "Tra", "Svi", "Lip", "Srp", "Kol", "Ruj", "Lis", "Stu", "Pro"], day_full: ["Nedjelja", "Ponedjeljak", "Utorak", "Srijeda", "Četvrtak", "Petak", "Subota"], day_short: ["Ned", "Pon", "Uto", "Sri", "Čet", "Pet", "Sub"] }, labels: { new_task: "Novi Zadatak", icon_save: "Spremi", icon_cancel: "Odustani", icon_details: "Detalji", icon_edit: "Izmjeni", icon_delete: "Obriši", confirm_closing: "", confirm_deleting: "Zadatak će biti trajno izbrisan, jeste li sigurni?", section_description: "Opis", section_time: "Vremenski Period", section_type: "Tip", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Naziv Zadatka", column_start_date: "Početno Vrijeme", column_duration: "Trajanje", column_add: "", link: "Poveznica", confirm_link_deleting: "će biti izbrisan", link_start: " (početak)", link_end: " (kraj)", type_task: "Zadatak", type_project: "Projekt", type_milestone: "Milestone", minutes: "Minute", hours: "Sati", days: "Dani", weeks: "Tjedni", months: "Mjeseci", years: "Godine", message_ok: "OK", message_cancel: "Odustani", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Rn = { date: { month_full: ["Január", "Február", "Március", "Április", "Május", "Június", "Július", "Augusztus", "Szeptember", "Október", "November", "December"], month_short: ["Jan", "Feb", "Már", "Ápr", "Máj", "Jún", "Júl", "Aug", "Sep", "Okt", "Nov", "Dec"], day_full: ["Vasárnap", "Hétfõ", "Kedd", "Szerda", "Csütörtök", "Péntek", "szombat"], day_short: ["Va", "Hé", "Ke", "Sze", "Csü", "Pé", "Szo"] }, labels: { new_task: "Új feladat", icon_save: "Mentés", icon_cancel: "Mégse", icon_details: "Részletek", icon_edit: "Szerkesztés", icon_delete: "Törlés", confirm_closing: "", confirm_deleting: "Az esemény törölve lesz, biztosan folytatja?", section_description: "Leírás", section_time: "Idõszak", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Mégse", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Nn = { date: { month_full: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"], month_short: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Ags", "Sep", "Okt", "Nov", "Des"], day_full: ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"], day_short: ["Ming", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"] }, labels: { new_task: "Tugas baru", icon_save: "Simpan", icon_cancel: "Batal", icon_details: "Detail", icon_edit: "Edit", icon_delete: "Hapus", confirm_closing: "", confirm_deleting: "Acara akan dihapus", section_description: "Keterangan", section_time: "Periode", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Batal", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, jn = { date: { month_full: ["Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno", "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"], month_short: ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"], day_full: ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"], day_short: ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"] }, labels: { new_task: "Nuovo compito", icon_save: "Salva", icon_cancel: "Chiudi", icon_details: "Dettagli", icon_edit: "Modifica", icon_delete: "Elimina", confirm_closing: "", confirm_deleting: "Sei sicuro di confermare l'eliminazione?", section_description: "Descrizione", section_time: "Periodo di tempo", section_type: "Tipo", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Nome Attività", column_start_date: "Inizio", column_duration: "Durata", column_add: "", link: "Link", confirm_link_deleting: "sarà eliminato", link_start: " (inizio)", link_end: " (fine)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minuti", hours: "Ore", days: "Giorni", weeks: "Settimane", months: "Mesi", years: "Anni", message_ok: "OK", message_cancel: "Chiudi", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Bn = { date: { month_full: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"], month_short: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"], day_full: ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"], day_short: ["日", "月", "火", "水", "木", "金", "土"] }, labels: { new_task: "新しい仕事", icon_save: "保存", icon_cancel: "キャンセル", icon_details: "詳細", icon_edit: "編集", icon_delete: "削除", confirm_closing: "", confirm_deleting: "イベント完全に削除されます、宜しいですか？", section_description: "デスクリプション", section_time: "期間", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "キャンセル", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Un = { date: { month_full: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"], month_short: ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"], day_full: ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"], day_short: ["일", "월", "화", "수", "목", "금", "토"] }, labels: { new_task: "이름없는 작업", icon_save: "저장", icon_cancel: "취소", icon_details: "세부 사항", icon_edit: "수정", icon_delete: "삭제", confirm_closing: "", confirm_deleting: "작업을 삭제하시겠습니까?", section_description: "설명", section_time: "기간", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "작업명", column_start_date: "시작일", column_duration: "기간", column_add: "", link: "전제", confirm_link_deleting: "삭제 하시겠습니까?", link_start: " (start)", link_end: " (end)", type_task: "작업", type_project: "프로젝트", type_milestone: "마일스톤", minutes: "분", hours: "시간", days: "일", weeks: "주", months: "달", years: "년", message_ok: "OK", message_cancel: "취소", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } };
class Wn {
  constructor(n) {
    this.addLocale = (t, a) => {
      this._locales[t] = a;
    }, this.getLocale = (t) => this._locales[t], this._locales = {};
    for (const t in n) this._locales[t] = n[t];
  }
}
const Fn = { date: { month_full: ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"], month_short: ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"], day_full: ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"], day_short: ["Søn", "Mon", "Tir", "Ons", "Tor", "Fre", "Lør"] }, labels: { new_task: "Ny oppgave", icon_save: "Lagre", icon_cancel: "Avbryt", icon_details: "Detaljer", icon_edit: "Rediger", icon_delete: "Slett", confirm_closing: "", confirm_deleting: "Hendelsen vil bli slettet permanent. Er du sikker?", section_description: "Beskrivelse", section_time: "Tidsperiode", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Avbryt", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Hn = { date: { month_full: ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"], month_short: ["Jan", "Feb", "mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"], day_full: ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"], day_short: ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"] }, labels: { new_task: "Nieuwe taak", icon_save: "Opslaan", icon_cancel: "Annuleren", icon_details: "Details", icon_edit: "Bewerken", icon_delete: "Verwijderen", confirm_closing: "", confirm_deleting: "Item zal permanent worden verwijderd, doorgaan?", section_description: "Beschrijving", section_time: "Tijd periode", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Taak omschrijving", column_start_date: "Startdatum", column_duration: "Duur", column_add: "", link: "Koppeling", confirm_link_deleting: "zal worden verwijderd", link_start: " (start)", link_end: " (eind)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "minuten", hours: "uren", days: "dagen", weeks: "weken", months: "maanden", years: "jaren", message_ok: "OK", message_cancel: "Annuleren", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, zn = { date: { month_full: ["Januar", "Februar", "Mars", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Desember"], month_short: ["Jan", "Feb", "Mar", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Des"], day_full: ["Søndag", "Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag"], day_short: ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"] }, labels: { new_task: "Ny oppgave", icon_save: "Lagre", icon_cancel: "Avbryt", icon_details: "Detaljer", icon_edit: "Endre", icon_delete: "Slett", confirm_closing: "Endringer blir ikke lagret, er du sikker?", confirm_deleting: "Oppføringen vil bli slettet, er du sikker?", section_description: "Beskrivelse", section_time: "Tidsperiode", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Avbryt", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Gn = { date: { month_full: ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"], month_short: ["Sty", "Lut", "Mar", "Kwi", "Maj", "Cze", "Lip", "Sie", "Wrz", "Paź", "Lis", "Gru"], day_full: ["Niedziela", "Poniedziałek", "Wtorek", "Środa", "Czwartek", "Piątek", "Sobota"], day_short: ["Nie", "Pon", "Wto", "Śro", "Czw", "Pią", "Sob"] }, labels: { new_task: "Nowe zadanie", icon_save: "Zapisz", icon_cancel: "Anuluj", icon_details: "Szczegóły", icon_edit: "Edytuj", icon_delete: "Usuń", confirm_closing: "", confirm_deleting: "Zdarzenie zostanie usunięte na zawsze, kontynuować?", section_description: "Opis", section_time: "Okres czasu", section_type: "Typ", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Nazwa zadania", column_start_date: "Początek", column_duration: "Czas trwania", column_add: "", link: "Link", confirm_link_deleting: "zostanie usunięty", link_start: " (początek)", link_end: " (koniec)", type_task: "Zadanie", type_project: "Projekt", type_milestone: "Milestone", minutes: "Minuty", hours: "Godziny", days: "Dni", weeks: "Tydzień", months: "Miesiące", years: "Lata", message_ok: "OK", message_cancel: "Anuluj", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Jn = { date: { month_full: ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"], month_short: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"], day_full: ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"], day_short: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"] }, labels: { new_task: "Nova tarefa", icon_save: "Salvar", icon_cancel: "Cancelar", icon_details: "Detalhes", icon_edit: "Editar", icon_delete: "Excluir", confirm_closing: "", confirm_deleting: "As tarefas serão excluidas permanentemente, confirme?", section_description: "Descrição", section_time: "Período", section_type: "Tipo", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "EAP", column_text: "Nome tarefa", column_start_date: "Data início", column_duration: "Duração", column_add: "", link: "Link", confirm_link_deleting: "Será excluído!", link_start: " (início)", link_end: " (fim)", type_task: "Task", type_project: "Projeto", type_milestone: "Marco", minutes: "Minutos", hours: "Horas", days: "Dias", weeks: "Semanas", months: "Meses", years: "Anos", message_ok: "OK", message_cancel: "Cancelar", section_constraint: "Restrição", constraint_type: "Tipo Restrição", constraint_date: "Data restrição", asap: "Mais breve possível", alap: "Mais tarde possível", snet: "Não começar antes de", snlt: "Não começar depois de", fnet: "Não terminar antes de", fnlt: "Não terminar depois de", mso: "Precisa começar em", mfo: "Precisa terminar em", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Vn = { date: { month_full: ["Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie", "Iulie", "August", "Septembrie", "Octombrie", "November", "December"], month_short: ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Nov", "Dec"], day_full: ["Duminica", "Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata"], day_short: ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sa"] }, labels: { new_task: "Sarcina noua", icon_save: "Salveaza", icon_cancel: "Anuleaza", icon_details: "Detalii", icon_edit: "Editeaza", icon_delete: "Sterge", confirm_closing: "Schimbarile nu vor fi salvate, esti sigur?", confirm_deleting: "Evenimentul va fi sters permanent, esti sigur?", section_description: "Descriere", section_time: "Interval", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Anuleaza", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Yn = { date: { month_full: ["Январь", "Февраль", "Март", "Апрель", "Maй", "Июнь", "Июль", "Август", "Сентябрь", "Oктябрь", "Ноябрь", "Декабрь"], month_short: ["Янв", "Фев", "Maр", "Aпр", "Maй", "Июн", "Июл", "Aвг", "Сен", "Окт", "Ноя", "Дек"], day_full: ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"], day_short: ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"] }, labels: { new_task: "Новое задание", icon_save: "Сохранить", icon_cancel: "Отменить", icon_details: "Детали", icon_edit: "Изменить", icon_delete: "Удалить", confirm_closing: "", confirm_deleting: "Событие будет удалено безвозвратно, продолжить?", section_description: "Описание", section_time: "Период времени", section_type: "Тип", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "ИСР", column_text: "Задача", column_start_date: "Начало", column_duration: "Длительность", column_add: "", link: "Связь", confirm_link_deleting: "будет удалена", link_start: " (начало)", link_end: " (конец)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Минута", hours: "Час", days: "День", weeks: "Неделя", months: "Месяц", years: "Год", message_ok: "OK", message_cancel: "Отменить", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Kn = { date: { month_full: ["Januar", "Februar", "Marec", "April", "Maj", "Junij", "Julij", "Avgust", "September", "Oktober", "November", "December"], month_short: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"], day_full: ["Nedelja", "Ponedeljek", "Torek", "Sreda", "Četrtek", "Petek", "Sobota"], day_short: ["Ned", "Pon", "Tor", "Sre", "Čet", "Pet", "Sob"] }, labels: { new_task: "Nova naloga", icon_save: "Shrani", icon_cancel: "Prekliči", icon_details: "Podrobnosti", icon_edit: "Uredi", icon_delete: "Izbriši", confirm_closing: "", confirm_deleting: "Dogodek bo izbrisan. Želite nadaljevati?", section_description: "Opis", section_time: "Časovni okvir", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Prekliči", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, qn = { date: { month_full: ["Január", "Február", "Marec", "Apríl", "Máj", "Jún", "Júl", "August", "September", "Október", "November", "December"], month_short: ["Jan", "Feb", "Mar", "Apr", "Máj", "Jún", "Júl", "Aug", "Sept", "Okt", "Nov", "Dec"], day_full: ["Nedeľa", "Pondelok", "Utorok", "Streda", "Štvrtok", "Piatok", "Sobota"], day_short: ["Ne", "Po", "Ut", "St", "Št", "Pi", "So"] }, labels: { new_task: "Nová úloha", icon_save: "Uložiť", icon_cancel: "Späť", icon_details: "Detail", icon_edit: "Edituj", icon_delete: "Zmazať", confirm_closing: "Vaše zmeny nebudú uložené. Skutočne?", confirm_deleting: "Udalosť bude natrvalo vymazaná. Skutočne?", section_description: "Poznámky", section_time: "Doba platnosti", section_type: "Type", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Späť", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Xn = { date: { month_full: ["Januari", "Februari", "Mars", "April", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"], month_short: ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"], day_full: ["Söndag", "Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag"], day_short: ["Sön", "Mån", "Tis", "Ons", "Tor", "Fre", "Lör"] }, labels: { new_task: "Ny uppgift", icon_save: "Spara", icon_cancel: "Avbryt", icon_details: "Detajer", icon_edit: "Ändra", icon_delete: "Ta bort", confirm_closing: "", confirm_deleting: "Är du säker på att du vill ta bort händelsen permanent?", section_description: "Beskrivning", section_time: "Tid", section_type: "Typ", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Uppgiftsnamn", column_start_date: "Starttid", column_duration: "Varaktighet", column_add: "", link: "Länk", confirm_link_deleting: "kommer tas bort", link_start: " (start)", link_end: " (slut)", type_task: "Uppgift", type_project: "Projekt", type_milestone: "Milstolpe", minutes: "Minuter", hours: "Timmar", days: "Dagar", weeks: "Veckor", months: "Månader", years: "År", message_ok: "OK", message_cancel: "Avbryt", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Zn = { date: { month_full: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"], month_short: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"], day_full: ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"], day_short: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"] }, labels: { new_task: "Yeni görev", icon_save: "Kaydet", icon_cancel: "İptal", icon_details: "Detaylar", icon_edit: "Düzenle", icon_delete: "Sil", confirm_closing: "", confirm_deleting: "Görev silinecek, emin misiniz?", section_description: "Açıklama", section_time: "Zaman Aralığı", section_type: "Tip", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Görev Adı", column_start_date: "Başlangıç", column_duration: "Süre", column_add: "", link: "Bağlantı", confirm_link_deleting: "silinecek", link_start: " (başlangıç)", link_end: " (bitiş)", type_task: "Görev", type_project: "Proje", type_milestone: "Kilometretaşı", minutes: "Dakika", hours: "Saat", days: "Gün", weeks: "Hafta", months: "Ay", years: "Yıl", message_ok: "OK", message_cancel: "Ýptal", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } }, Qn = { date: { month_full: ["Січень", "Лютий", "Березень", "Квітень", "Травень", "Червень", "Липень", "Серпень", "Вересень", "Жовтень", "Листопад", "Грудень"], month_short: ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"], day_full: ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"], day_short: ["Нед", "Пон", "Вів", "Сер", "Чет", "Птн", "Суб"] }, labels: { new_task: "Нове завдання", icon_save: "Зберегти", icon_cancel: "Відміна", icon_details: "Деталі", icon_edit: "Редагувати", icon_delete: "Вилучити", confirm_closing: "", confirm_deleting: "Подія вилучиться назавжди. Ви впевнені?", section_description: "Опис", section_time: "Часовий проміжок", section_type: "Тип", section_deadline: "Deadline", section_baselines: "Baselines", section_new_resources: "Resources", column_wbs: "WBS", column_text: "Task name", column_start_date: "Start time", column_duration: "Duration", column_add: "", link: "Link", confirm_link_deleting: "will be deleted", link_start: " (start)", link_end: " (end)", type_task: "Task", type_project: "Project", type_milestone: "Milestone", minutes: "Minutes", hours: "Hours", days: "Days", weeks: "Week", months: "Months", years: "Years", message_ok: "OK", message_cancel: "Відміна", section_constraint: "Constraint", constraint_type: "Constraint type", constraint_date: "Constraint date", asap: "As Soon As Possible", alap: "As Late As Possible", snet: "Start No Earlier Than", snlt: "Start No Later Than", fnet: "Finish No Earlier Than", fnlt: "Finish No Later Than", mso: "Must Start On", mfo: "Must Finish On", resources_add_button: "Add Assignment", resources_filter_placeholder: "Search...", resources_filter_label: "hide empty", resources_section_placeholder: "Nothing assigned yet. Click 'Add Assignment' to assign resources.", empty_state_text_link: "Click here", empty_state_text_description: "to create your first task", baselines_section_placeholder: "Start adding a new baseline", baselines_add_button: "Add Baseline", baselines_remove_button: "Remove", baselines_remove_all_button: "Remove All", deadline_enable_button: "Set", deadline_disable_button: "Remove" } };
function ea() {
  this.constants = wt, this.version = "9.1.1", this.license = "evaluation", this.templates = {}, this.ext = {}, this.keys = { edit_save: this.constants.KEY_CODES.ENTER, edit_cancel: this.constants.KEY_CODES.ESC };
}
const ta = new class {
  constructor(e, n) {
    this.plugin = (t) => {
      this._ganttPlugin.push(t), U.gantt !== void 0 && U.gantt.getTask && t(U.gantt);
    }, this.getGanttInstance = (t) => {
      const a = this._factoryMethod(this._bundledExtensions);
      for (let s = 0; s < this._ganttPlugin.length; s++) this._ganttPlugin[s](a);
      return a._internal_id = this._seed++, t && this._initFromConfig(a, t), a;
    }, this._initFromConfig = (t, a) => {
      if (a.plugins) for (const s in a.plugins)
        this._extensionsManager.getExtension(s) && t.plugins({ [s]: !0 });
      if (a.config && t.mixin(t.config, a.config, !0), a.templates && t.attachEvent("onTemplatesReady", function() {
        t.mixin(t.templates, a.templates, !0);
      }, { once: !0 }), a.events) for (const s in a.events) t.attachEvent(s, a.events[s]);
      a.locale && t.i18n.setLocale(a.locale), Array.isArray(a.calendars) && a.calendars.forEach(function(s) {
        t.addCalendar(s);
      }), a.container ? t.init(a.container) : t.init(), a.data && (typeof a.data == "string" ? t.load(a.data) : t.parse(a.data));
    }, this._seed = 0, this._ganttPlugin = [], this._factoryMethod = e, this._bundledExtensions = n, this._extensionsManager = new ze(n);
  }
}(function(e) {
  var n = new ea(), t = new ze(e), a = {};
  n.plugins = function(r) {
    for (var d in r) if (r[d] && !a[d]) {
      var c = t.getExtension(d);
      c && (c(n), a[d] = !0);
    }
    return a;
  }, n.$services = /* @__PURE__ */ function() {
    var r = {};
    return { services: {}, setService: function(d, c) {
      r[d] = c;
    }, getService: function(d) {
      return r[d] ? r[d]() : null;
    }, dropService: function(d) {
      r[d] && delete r[d];
    }, destructor: function() {
      for (var d in r) if (r[d]) {
        var c = r[d];
        c && c.destructor && c.destructor();
      }
      r = null;
    } };
  }(), n.config = { layout: { css: "gantt_container", rows: [{ cols: [{ view: "grid", scrollX: "scrollHor", scrollY: "scrollVer" }, { resizer: !0, width: 1 }, { view: "timeline", scrollX: "scrollHor", scrollY: "scrollVer" }, { view: "scrollbar", id: "scrollVer" }] }, { view: "scrollbar", id: "scrollHor", height: 20 }] }, links: { finish_to_start: "0", start_to_start: "1", finish_to_finish: "2", start_to_finish: "3" }, types: { task: "task", project: "project", milestone: "milestone" }, auto_types: !1, duration_unit: "day", work_time: !1, correct_work_time: !1, skip_off_time: !1, cascade_delete: !0, autosize: !1, autosize_min_width: 0, autoscroll: !0, autoscroll_speed: 30, deepcopy_on_parse: !1, show_links: !0, show_task_cells: !0, static_background: !1, static_background_cells: !0, branch_loading: !1, branch_loading_property: "$has_child", show_loading: !1, show_chart: !0, show_grid: !0, min_duration: 36e5, date_format: "%d-%m-%Y %H:%i", xml_date: void 0, start_on_monday: !0, server_utc: !1, show_progress: !0, fit_tasks: !1, select_task: !0, scroll_on_click: !0, smart_rendering: !0, preserve_scroll: !0, readonly: !1, container_resize_timeout: 20, deadlines: !0, date_grid: "%Y-%m-%d", drag_links: !0, drag_progress: !0, drag_resize: !0, drag_project: !1, drag_move: !0, drag_mode: { resize: "resize", progress: "progress", move: "move", ignore: "ignore" }, round_dnd_dates: !0, link_wrapper_width: 20, link_arrow_size: 12, root_id: 0, autofit: !1, columns: [{ name: "text", tree: !0, width: "*", resize: !0 }, { name: "start_date", align: "center", resize: !0 }, { name: "duration", align: "center" }, { name: "add", width: 44 }], scale_offset_minimal: !0, inherit_scale_class: !1, scales: [{ unit: "day", step: 1, date: "%d %M" }], time_step: 60, duration_step: 1, task_date: "%d %F %Y", time_picker: "%H:%i", task_attribute: "data-task-id", link_attribute: "data-link-id", layer_attribute: "data-layer", buttons_left: ["gantt_save_btn", "gantt_cancel_btn"], _migrate_buttons: { dhx_save_btn: "gantt_save_btn", dhx_cancel_btn: "gantt_cancel_btn", dhx_delete_btn: "gantt_delete_btn" }, buttons_right: ["gantt_delete_btn"], lightbox: { sections: [{ name: "description", height: 70, map_to: "text", type: "textarea", focus: !0 }, { name: "time", type: "duration", map_to: "auto" }], project_sections: [{ name: "description", height: 70, map_to: "text", type: "textarea", focus: !0 }, { name: "type", type: "typeselect", map_to: "type" }, { name: "time", type: "duration", readonly: !0, map_to: "auto" }], milestone_sections: [{ name: "description", height: 70, map_to: "text", type: "textarea", focus: !0 }, { name: "type", type: "typeselect", map_to: "type" }, { name: "time", type: "duration", single_date: !0, map_to: "auto" }] }, drag_lightbox: !0, sort: !1, details_on_create: !0, details_on_dblclick: !0, initial_scroll: !0, task_scroll_offset: 100, order_branch: !1, order_branch_free: !1, task_height: void 0, bar_height: "full", bar_height_padding: 9, min_column_width: 70, min_grid_column_width: 70, grid_resizer_column_attribute: "data-column-index", keep_grid_width: !1, grid_resize: !1, grid_elastic_columns: !1, show_tasks_outside_timescale: !1, show_unscheduled: !0, resize_rows: !1, task_grid_row_resizer_attribute: "data-row-index", min_task_grid_row_height: 30, row_height: 36, readonly_property: "readonly", editable_property: "editable", calendar_property: "calendar_id", resource_calendars: {}, dynamic_resource_calendars: !1, inherit_calendar: !1, type_renderers: {}, open_tree_initially: !1, optimize_render: !0, prevent_default_scroll: !1, show_errors: !0, wai_aria_attributes: !0, smart_scales: !0, rtl: !1, placeholder_task: !1, horizontal_scroll_key: "shiftKey", drag_timeline: { useKey: void 0, ignore: ".gantt_task_line, .gantt_task_link", render: !1 }, drag_multiple: !0, csp: "auto", auto_scheduling: {} }, n.ajax = /* @__PURE__ */ function(r) {
    return { cache: !0, method: "get", parse: function(d) {
      return typeof d != "string" ? d : (d = d.replace(/^[\s]+/, ""), typeof DOMParser > "u" || de.isIE ? U.ActiveXObject !== void 0 && ((c = new U.ActiveXObject("Microsoft.XMLDOM")).async = "false", c.loadXML(d)) : c = new DOMParser().parseFromString(d, "text/xml"), c);
      var c;
    }, xmltop: function(d, c, u) {
      if (c.status === void 0 || c.status < 400) {
        var _ = c.responseXML ? c.responseXML || c : this.parse(c.responseText || c);
        if (_ && _.documentElement !== null && !_.getElementsByTagName("parsererror").length) return _.getElementsByTagName(d)[0];
      }
      return u !== -1 && r.callEvent("onLoadXMLError", ["Incorrect XML", arguments[1], u]), document.createElement("DIV");
    }, xpath: function(d, c) {
      if (c.nodeName || (c = c.responseXML || c), de.isIE) return c.selectNodes(d) || [];
      for (var u, _ = [], h = (c.ownerDocument || c).evaluate(d, c, null, XPathResult.ANY_TYPE, null); u = h.iterateNext(); ) _.push(u);
      return _;
    }, query: function(d) {
      return this._call(d.method || "GET", d.url, d.data || "", d.async || !0, d.callback, d.headers);
    }, get: function(d, c, u) {
      var _ = Z("GET", arguments);
      return this.query(_);
    }, getSync: function(d, c) {
      var u = Z("GET", arguments);
      return u.async = !1, this.query(u);
    }, put: function(d, c, u, _) {
      var h = Z("PUT", arguments);
      return this.query(h);
    }, del: function(d, c, u) {
      var _ = Z("DELETE", arguments);
      return this.query(_);
    }, post: function(d, c, u, _) {
      arguments.length == 1 ? c = "" : arguments.length == 2 && typeof c == "function" && (u = c, c = "");
      var h = Z("POST", arguments);
      return this.query(h);
    }, postSync: function(d, c, u) {
      c = c === null ? "" : String(c);
      var _ = Z("POST", arguments);
      return _.async = !1, this.query(_);
    }, _call: function(d, c, u, _, h, g) {
      return new r.Promise(function(p, k) {
        var v = typeof XMLHttpRequest !== void 0 ? new XMLHttpRequest() : new U.ActiveXObject("Microsoft.XMLHTTP"), f = navigator.userAgent.match(/AppleWebKit/) !== null && navigator.userAgent.match(/Qt/) !== null && navigator.userAgent.match(/Safari/) !== null;
        _ && (v.onreadystatechange = function() {
          if (v.readyState == 4 || f && v.readyState == 3) {
            if ((v.status < 200 || v.status > 299 || v.responseText === "") && !r.callEvent("onAjaxError", [v])) return;
            setTimeout(function() {
              typeof h == "function" && h.apply(U, [{ xmlDoc: v, filePath: c }]), p(v), typeof h == "function" && (h = null, v = null);
            }, 0);
          }
        });
        var y = !this || !this.cache;
        if (d == "GET" && y && (c += (c.indexOf("?") >= 0 ? "&" : "?") + "dhxr" + (/* @__PURE__ */ new Date()).getTime() + "=1"), v.open(d, c, _), g) for (var m in g) v.setRequestHeader(m, g[m]);
        else d.toUpperCase() == "POST" || d == "PUT" || d == "DELETE" ? v.setRequestHeader("Content-Type", "application/x-www-form-urlencoded") : d == "GET" && (u = null);
        if (v.setRequestHeader("X-Requested-With", "XMLHttpRequest"), v.send(u), !_) return { xmlDoc: v, filePath: c };
      });
    }, urlSeparator: function(d) {
      return d.indexOf("?") != -1 ? "&" : "?";
    } };
  }(n), n.date = Ct(n), n.RemoteEvents = Et;
  var s = Pt(n);
  n.$services.setService("dnd", function() {
    return s;
  });
  var i = /* @__PURE__ */ function(r) {
    var d = {};
    function c(u, _, h) {
      h = h || u;
      var g = r.config, p = r.templates;
      r.config[u] && d[h] != g[u] && (_ && p[h] || (p[h] = r.date.date_to_str(g[u]), d[h] = g[u]));
    }
    return { initTemplates: function() {
      var u = r.date, _ = u.date_to_str, h = r.config, g = _(h.xml_date || h.date_format, h.server_utc), p = u.str_to_date(h.xml_date || h.date_format, h.server_utc);
      c("date_scale", !0, void 0, r.config, r.templates), c("date_grid", !0, "grid_date_format", r.config, r.templates), c("task_date", !0, void 0, r.config, r.templates), r.mixin(r.templates, { xml_format: void 0, format_date: g, xml_date: void 0, parse_date: p, progress_text: function(k, v, f) {
        return "";
      }, grid_header_class: function(k, v) {
        return "";
      }, task_text: function(k, v, f) {
        return f.text;
      }, task_class: function(k, v, f) {
        return "";
      }, task_end_date: function(k) {
        return r.templates.task_date(k);
      }, grid_row_class: function(k, v, f) {
        return "";
      }, task_row_class: function(k, v, f) {
        return "";
      }, timeline_cell_class: function(k, v) {
        return "";
      }, timeline_cell_content: function(k, v) {
        return "";
      }, scale_cell_class: function(k) {
        return "";
      }, scale_row_class: function(k) {
        return "";
      }, grid_indent: function(k) {
        return "<div class='gantt_tree_indent'></div>";
      }, grid_folder: function(k) {
        return "<div class='gantt_tree_icon gantt_folder_" + (k.$open ? "open" : "closed") + "'></div>";
      }, grid_file: function(k) {
        return "<div class='gantt_tree_icon gantt_file'></div>";
      }, grid_open: function(k) {
        return "<div class='gantt_tree_icon gantt_" + (k.$open ? "close" : "open") + "'></div>";
      }, grid_blank: function(k) {
        return "<div class='gantt_tree_icon gantt_blank'></div>";
      }, date_grid: function(k, v, f) {
        return v && r.isUnscheduledTask(v) && r.config.show_unscheduled ? r.templates.task_unscheduled_time(v) : r.templates.grid_date_format(k, f);
      }, task_time: function(k, v, f) {
        return r.isUnscheduledTask(f) && r.config.show_unscheduled ? r.templates.task_unscheduled_time(f) : r.templates.task_date(k) + " - " + r.templates.task_end_date(v);
      }, task_unscheduled_time: function(k) {
        return "";
      }, time_picker: _(h.time_picker), link_class: function(k) {
        return "";
      }, link_description: function(k) {
        var v = r.getTask(k.source), f = r.getTask(k.target);
        return "<b>" + v.text + "</b> &ndash;  <b>" + f.text + "</b>";
      }, drag_link: function(k, v, f, y) {
        k = r.getTask(k);
        var m = r.locale.labels, S = "<b>" + k.text + "</b> " + (v ? m.link_start : m.link_end) + "<br/>";
        return f && (S += "<b> " + (f = r.getTask(f)).text + "</b> " + (y ? m.link_start : m.link_end) + "<br/>"), S;
      }, drag_link_class: function(k, v, f, y) {
        var m = "";
        return k && f && (m = " " + (r.isLinkAllowed(k, f, v, y) ? "gantt_link_allow" : "gantt_link_deny")), "gantt_link_tooltip" + m;
      }, tooltip_date_format: u.date_to_str("%Y-%m-%d"), tooltip_text: function(k, v, f) {
        return `<div>Task: ${f.text}</div>
				<div>Start date: ${r.templates.tooltip_date_format(k)}</div>
				<div>End date: ${r.templates.tooltip_date_format(v)}</div>`;
      }, baseline_text: function(k, v, f) {
        return "";
      } });
    }, initTemplate: c };
  }(n);
  n.$services.setService("templateLoader", function() {
    return i;
  }), ie(n);
  var o = new Rt();
  o.registerProvider("global", function() {
    var r = { min_date: n._min_date, max_date: n._max_date, selected_task: null };
    return n.$data && n.$data.tasksStore && (r.selected_task = n.$data.tasksStore.getSelectedId()), r;
  }), n.getState = o.getState, n.$services.setService("state", function() {
    return o;
  }), B(n, yt), n.Promise = Nt, n.env = de, function(r) {
    var d = Ut.create();
    B(r, d);
    var c, u = r.createDatastore({ name: "task", type: "treeDatastore", rootId: function() {
      return r.config.root_id;
    }, initItem: O(function(f) {
      this.defined(f.id) || (f.id = this.uid()), f.start_date && (f.start_date = r.date.parseDate(f.start_date, "parse_date")), f.end_date && (f.end_date = r.date.parseDate(f.end_date, "parse_date"));
      var y = null;
      (f.duration || f.duration === 0) && (f.duration = y = 1 * f.duration), y && (f.start_date && !f.end_date ? f.end_date = this.calculateEndDate(f) : !f.start_date && f.end_date && (f.start_date = this.calculateEndDate({ start_date: f.end_date, duration: -f.duration, task: f }))), r.config.deadlines !== !1 && f.deadline && (f.deadline = r.date.parseDate(f.deadline, "parse_date")), f.progress = Number(f.progress) || 0, this._isAllowedUnscheduledTask(f) && this._set_default_task_timing(f), this._init_task_timing(f), f.start_date && f.end_date && this.correctTaskWorkTime(f), f.$source = [], f.$target = [];
      var m = this.$data.tasksStore.getItem(f.id);
      return m && !j(f.open) && (f.$open = m.$open), f.parent === void 0 && (f.parent = this.config.root_id), f.open && (f.$open = !0), f;
    }, r), getConfig: function() {
      return r.config;
    } }), _ = r.createDatastore({ name: "link", initItem: O(function(f) {
      return this.defined(f.id) || (f.id = this.uid()), f;
    }, r) });
    function h(f) {
      var y = r.isTaskVisible(f);
      if (!y && r.isTaskExists(f)) {
        var m = r.getParent(f);
        r.isTaskExists(m) && r.isTaskVisible(m) && (m = r.getTask(m), r.isSplitTask(m) && (y = !0));
      }
      return y;
    }
    function g(f, y) {
      return y.indexOf(String(f)) === -1 && y.indexOf(Number(f)) === -1;
    }
    function p(f) {
      if (r.isTaskExists(f.source)) {
        for (var y = r.getTask(f.source), m = 0; m < y.$source.length; m++) if (y.$source[m] == f.id) {
          y.$source.splice(m, 1);
          break;
        }
      }
      if (r.isTaskExists(f.target)) {
        var S = r.getTask(f.target);
        for (m = 0; m < S.$target.length; m++) if (S.$target[m] == f.id) {
          S.$target.splice(m, 1);
          break;
        }
      }
    }
    function k() {
      for (var f = null, y = r.$data.tasksStore.getItems(), m = 0, S = y.length; m < S; m++) (f = y[m]).$source = [], f.$target = [];
      var C = r.$data.linksStore.getItems();
      for (m = 0, S = C.length; m < S; m++) {
        var b = C[m];
        _.sync_link(b);
      }
    }
    function v(f) {
      var y = f.source, m = f.target;
      for (var S in f.events) (function(C, b) {
        y.attachEvent(C, function() {
          return m.callEvent(b, Array.prototype.slice.call(arguments));
        }, b);
      })(S, f.events[S]);
    }
    r.attachEvent("onDestroy", function() {
      u.destructor(), _.destructor();
    }), r.attachEvent("onLinkValidation", function(f) {
      if (r.isLinkExists(f.id) || f.id === "predecessor_generated") return !0;
      for (var y = r.getTask(f.source).$source, m = 0; m < y.length; m++) {
        var S = r.getLink(y[m]), C = f.source == S.source, b = f.target == S.target, T = f.type == S.type;
        if (C && b && T) return !1;
      }
      return !0;
    }), u.attachEvent("onBeforeRefreshAll", function() {
      if (!u._skipTaskRecalculation) for (var f = u.getVisibleItems(), y = 0; y < f.length; y++) {
        var m = f[y];
        m.$index = y, m.$local_index = r.getTaskIndex(m.id), r.resetProjectDates(m);
      }
    }), u.attachEvent("onFilterItem", function(f, y) {
      if (r.config.show_tasks_outside_timescale) return !0;
      var m = null, S = null;
      if (r.config.start_date && r.config.end_date) {
        if (r._isAllowedUnscheduledTask(y)) return !0;
        if (m = r.config.start_date.valueOf(), S = r.config.end_date.valueOf(), +y.start_date > S || +y.end_date < +m) return !1;
      }
      return !0;
    }), u.attachEvent("onIdChange", function(f, y) {
      r._update_flags(f, y);
      var m = r.getTask(y);
      u.isSilent() || (m.$split_subtask || m.rollup) && r.eachParent(function(S) {
        r.refreshTask(S.id);
      }, y);
    }), u.attachEvent("onAfterUpdate", function(f) {
      if (r._update_parents(f), r.getState("batchUpdate").batch_update) return !0;
      var y = u.getItem(f);
      y.$source || (y.$source = []);
      for (var m = 0; m < y.$source.length; m++) _.refresh(y.$source[m]);
      for (y.$target || (y.$target = []), m = 0; m < y.$target.length; m++) _.refresh(y.$target[m]);
    }), u.attachEvent("onBeforeItemMove", function(f, y, m) {
      return !Re(f, r, u) || (console.log("The placeholder task cannot be moved to another position."), !1);
    }), u.attachEvent("onAfterItemMove", function(f, y, m) {
      var S = r.getTask(f);
      this.getNextSibling(f) !== null ? S.$drop_target = this.getNextSibling(f) : this.getPrevSibling(f) !== null ? S.$drop_target = "next:" + this.getPrevSibling(f) : S.$drop_target = "next:null";
    }), u.attachEvent("onStoreUpdated", function(f, y, m) {
      if (m == "delete" && r._update_flags(f, null), !r.$services.getService("state").getState("batchUpdate").batch_update) {
        if (r.config.fit_tasks && m !== "paint") {
          var S = r.getState();
          Ce(r);
          var C = r.getState();
          if (+S.min_date != +C.min_date || +S.max_date != +C.max_date) return r.render(), r.callEvent("onScaleAdjusted", []), !0;
        }
        m == "add" || m == "move" || m == "delete" ? r.$layout && (this.$config.name != "task" || m != "add" && m != "delete" || this._skipTaskRecalculation != "lightbox" && (this._skipTaskRecalculation = !0), r.$layout.resize()) : f || _.refresh();
      }
    }), _.attachEvent("onAfterAdd", function(f, y) {
      _.sync_link(y);
    }), _.attachEvent("onAfterUpdate", function(f, y) {
      k();
    }), _.attachEvent("onAfterDelete", function(f, y) {
      p(y);
    }), _.attachEvent("onAfterSilentDelete", function(f, y) {
      p(y);
    }), _.attachEvent("onBeforeIdChange", function(f, y) {
      p(r.mixin({ id: f }, r.$data.linksStore.getItem(y))), _.sync_link(r.$data.linksStore.getItem(y));
    }), _.attachEvent("onFilterItem", function(f, y) {
      if (!r.config.show_links) return !1;
      var m = h(y.source), S = h(y.target);
      return !(!m || !S || r._isAllowedUnscheduledTask(r.getTask(y.source)) || r._isAllowedUnscheduledTask(r.getTask(y.target))) && r.callEvent("onBeforeLinkDisplay", [f, y]);
    }), c = {}, r.attachEvent("onBeforeTaskDelete", function(f, y) {
      return c[f] = Ee.getSubtreeLinks(r, f), !0;
    }), r.attachEvent("onAfterTaskDelete", function(f, y) {
      c[f] && r.$data.linksStore.silent(function() {
        for (var m in c[f]) r.isLinkExists(m) && r.$data.linksStore.removeItem(m), p(c[f][m]);
        c[f] = null;
      });
    }), r.attachEvent("onAfterLinkDelete", function(f, y) {
      r.isTaskExists(y.source) && r.refreshTask(y.source), r.isTaskExists(y.target) && r.refreshTask(y.target);
    }), r.attachEvent("onParse", k), v({ source: _, target: r, events: { onItemLoading: "onLinkLoading", onBeforeAdd: "onBeforeLinkAdd", onAfterAdd: "onAfterLinkAdd", onBeforeUpdate: "onBeforeLinkUpdate", onAfterUpdate: "onAfterLinkUpdate", onBeforeDelete: "onBeforeLinkDelete", onAfterDelete: "onAfterLinkDelete", onIdChange: "onLinkIdChange" } }), v({ source: u, target: r, events: { onItemLoading: "onTaskLoading", onBeforeAdd: "onBeforeTaskAdd", onAfterAdd: "onAfterTaskAdd", onBeforeUpdate: "onBeforeTaskUpdate", onAfterUpdate: "onAfterTaskUpdate", onBeforeDelete: "onBeforeTaskDelete", onAfterDelete: "onAfterTaskDelete", onIdChange: "onTaskIdChange", onBeforeItemMove: "onBeforeTaskMove", onAfterItemMove: "onAfterTaskMove", onFilterItem: "onBeforeTaskDisplay", onItemOpen: "onTaskOpened", onItemClose: "onTaskClosed", onBeforeSelect: "onBeforeTaskSelected", onAfterSelect: "onTaskSelected", onAfterUnselect: "onTaskUnselected" } }), r.$data = { tasksStore: u, linksStore: _ }, _.sync_link = function(f) {
      if (r.isTaskExists(f.source)) {
        var y = r.getTask(f.source);
        y.$source = y.$source || [], g(f.id, y.$source) && y.$source.push(f.id);
      }
      if (r.isTaskExists(f.target)) {
        var m = r.getTask(f.target);
        m.$target = m.$target || [], g(f.id, m.$target) && m.$target.push(f.id);
      }
    };
  }(n), n.dataProcessor = Ht, n.createDataProcessor = zt, function(r) {
    r.ext || (r.ext = {});
    for (var d = [Jt, Vt, qt, Xt, Zt, Qt, en, tn, an, on], c = 0; c < d.length; c++) d[c] && d[c](r);
    const { getAutoSchedulingConfig: u } = nt(r);
    r._getAutoSchedulingConfig = u;
  }(n), function(r) {
    (function(d) {
      d.getGridColumn = function(c) {
        for (var u = d.config.columns, _ = 0; _ < u.length; _++) if (u[_].name == c) return u[_];
        return null;
      }, d.getGridColumns = function() {
        return d.config.columns.slice();
      };
    })(r), ct.prototype.getGridColumns = function() {
      for (var d = this.$getConfig().columns, c = [], u = 0; u < d.length; u++) d[u].hide || c.push(d[u]);
      return c;
    };
  }(n), function(r) {
    r.isReadonly = function(d) {
      return typeof d != "number" && typeof d != "string" || !r.isTaskExists(d) || (d = r.getTask(d)), (!d || !d[this.config.editable_property]) && (d && d[this.config.readonly_property] || this.config.readonly);
    };
  }(n), un(n), function(r) {
    var d = new ht(r), c = new gt(d);
    B(r, kn(d, c));
  }(n), vn(n), function(r) {
    r.getTaskType = function(d) {
      var c = d;
      for (var u in d && typeof d == "object" && (c = d.type), this.config.types) if (this.config.types[u] == c) return c;
      return r.config.types.task;
    };
  }(n), function(r) {
    function d() {
      return r._cached_functions.update_if_changed(r), r._cached_functions.active || r._cached_functions.activate(), !0;
    }
    r._cached_functions = { cache: {}, mode: !1, critical_path_mode: !1, wrap_methods: function(u, _) {
      if (_._prefetch_originals) for (var h in _._prefetch_originals) _[h] = _._prefetch_originals[h];
      for (_._prefetch_originals = {}, h = 0; h < u.length; h++) this.prefetch(u[h], _);
    }, prefetch: function(u, _) {
      var h = _[u];
      if (h) {
        var g = this;
        _._prefetch_originals[u] = h, _[u] = function() {
          for (var p = new Array(arguments.length), k = 0, v = arguments.length; k < v; k++) p[k] = arguments[k];
          if (g.active) {
            var f = g.get_arguments_hash(Array.prototype.slice.call(p));
            g.cache[u] || (g.cache[u] = {});
            var y = g.cache[u];
            if (g.has_cached_value(y, f)) return g.get_cached_value(y, f);
            var m = h.apply(this, p);
            return g.cache_value(y, f, m), m;
          }
          return h.apply(this, p);
        };
      }
      return h;
    }, cache_value: function(u, _, h) {
      this.is_date(h) && (h = new Date(h)), u[_] = h;
    }, has_cached_value: function(u, _) {
      return u.hasOwnProperty(_);
    }, get_cached_value: function(u, _) {
      var h = u[_];
      return this.is_date(h) && (h = new Date(h)), h;
    }, is_date: function(u) {
      return u && u.getUTCDate;
    }, get_arguments_hash: function(u) {
      for (var _ = [], h = 0; h < u.length; h++) _.push(this.stringify_argument(u[h]));
      return "(" + _.join(";") + ")";
    }, stringify_argument: function(u) {
      return (u.id ? u.id : this.is_date(u) ? u.valueOf() : u) + "";
    }, activate: function() {
      this.clear(), this.active = !0;
    }, deactivate: function() {
      this.clear(), this.active = !1;
    }, clear: function() {
      this.cache = {};
    }, setup: function(u) {
      var _ = [], h = ["_isProjectEnd", "_getProjectEnd", "_getSlack"];
      this.mode == "auto" ? u.config.highlight_critical_path && (_ = h) : this.mode === !0 && (_ = h), this.wrap_methods(_, u);
    }, update_if_changed: function(u) {
      (this.critical_path_mode != u.config.highlight_critical_path || this.mode !== u.config.optimize_render) && (this.critical_path_mode = u.config.highlight_critical_path, this.mode = u.config.optimize_render, this.setup(u));
    } }, r.attachEvent("onBeforeGanttRender", d), r.attachEvent("onBeforeDataRender", d), r.attachEvent("onBeforeSmartRender", function() {
      d();
    }), r.attachEvent("onBeforeParse", d), r.attachEvent("onDataRender", function() {
      r._cached_functions.deactivate();
    });
    var c = null;
    r.attachEvent("onSmartRender", function() {
      c && clearTimeout(c), c = setTimeout(function() {
        r._cached_functions.deactivate();
      }, 1e3);
    }), r.attachEvent("onBeforeGanttReady", function() {
      return r._cached_functions.update_if_changed(r), !0;
    });
  }(n), yn(n), function(r) {
    r.destructor = function() {
      for (var d in this.clearAll(), this.callEvent("onDestroy", []), this._getDatastores().forEach(function(c) {
        c.destructor();
      }), this.$root && delete this.$root.gantt, this._eventRemoveAll && this._eventRemoveAll(), this.$layout && this.$layout.destructor(), this.resetLightbox && this.resetLightbox(), this.ext.inlineEditors && this.ext.inlineEditors.destructor && this.ext.inlineEditors.destructor(), this._dp && this._dp.destructor && this._dp.destructor(), this.$services.destructor(), this.detachAllEvents(), this) d.indexOf("$") === 0 && delete this[d];
      this.$destroyed = !0;
    };
  }(n);
  var l = new Wn({ en: An, ar: bn, be: Sn, ca: Tn, cn: xn, cs: wn, da: Cn, de: En, el: $n, es: Dn, fa: Mn, fi: Ln, fr: In, he: On, hr: Pn, hu: Rn, id: Nn, it: jn, jp: Bn, kr: Un, nb: Fn, nl: Hn, no: zn, pl: Gn, pt: Jn, ro: Vn, ru: Yn, si: Kn, sk: qn, sv: Xn, tr: Zn, ua: Qn });
  return n.i18n = { addLocale: l.addLocale, setLocale: function(r) {
    if (typeof r == "string") {
      var d = l.getLocale(r);
      d || (d = l.getLocale("en")), n.locale = d;
    } else if (r) if (n.locale) for (var c in r) r[c] && typeof r[c] == "object" ? (n.locale[c] || (n.locale[c] = {}), n.mixin(n.locale[c], r[c], !0)) : n.locale[c] = r[c];
    else n.locale = r;
    const u = n.locale.labels;
    u.gantt_save_btn = u.gantt_save_btn || u.icon_save, u.gantt_cancel_btn = u.gantt_cancel_btn || u.icon_cancel, u.gantt_delete_btn = u.gantt_delete_btn || u.icon_delete;
  }, getLocale: l.getLocale }, n.i18n.setLocale("en"), n;
}, xt), na = ta.getGanttInstance();
export {
  ta as Gantt,
  na as default,
  na as gantt
};
