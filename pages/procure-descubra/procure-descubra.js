/* ==========================================================
 * Procure & Descubra — INIT à prova de SPA (com limpar simples)
 * ========================================================== */
(function () {
  const ROOT_ID = "procureDescubra";

  const $  = (id) => document.getElementById(id);
  const on = (el, ev, fn) => el && el.addEventListener(ev, fn, { passive: true });

  function apiBase(){
    return (window.apiBaseUrl || "").trim().replace(/\/+$/, "");
  }
  const urlPorRef      = (ref)           => `${apiBase()}/versiculos/por-referencia?ref=${encodeURIComponent(ref)}`;
  const urlPorCampos   = (livro,c,v)     => `${apiBase()}/versiculos/buscar?livro=${encodeURIComponent(livro)}&capitulo=${encodeURIComponent(c||"")}&versiculo=${encodeURIComponent(v||"")}`;
  const urlListaLivros = ()              => `${apiBase()}/versiculos/livros`;

  /* ---------------- UI helpers ---------------- */
  function show(el){ el && el.classList.remove("hidden"); }
  function hide(el){ el && el.classList.add("hidden"); }
  function escapeHtml(s=""){return String(s).replace(/[&<>"']/g,(m)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));}

  function setMsg(type, html){
    const box = $("msg"); if (!box) return;
    const c = type === "error"
      ? "bg-red-50 text-red-700 ring-1 ring-red-200"
      : "bg-yellow-50 text-yellow-800 ring-1 ring-yellow-200";
    box.className = `mt-6 p-4 rounded-xl ${c}`;
    box.innerHTML = html; show(box);
  }
  function clearMsg(){ const box=$("msg"); if (box){ box.innerHTML=""; hide(box);} }

  // 🔔 Toast minimalista (mesmo estilo de antes)
  function toast(msg){
    let el = $("snackbar");
    if (!el) {
      el = document.createElement("div");
      el.id = "snackbar";
      el.className = "fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] px-4 py-2 rounded-xl bg-yellow-400 text-black font-semibold shadow-lg transition-opacity";
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    clearTimeout(el._t);
    el._t = setTimeout(()=>{ el.style.opacity = "0"; }, 1800);
  }

  function cardVerso(v){
    const ref = `${v.livro} ${v.capitulo}${v.versiculo?":"+v.versiculo:""}`;
    return `
      <article class="bg-white text-black ring-1 ring-zinc-200 rounded-2xl p-6 shadow-xl">
        <header class="flex items-center justify-between gap-4 mb-3">
          <h3 class="text-lg font-bold text-zinc-900">${escapeHtml(ref)}</h3>
          <button class="copy-btn px-3 py-1 rounded-lg text-sm bg-zinc-100 hover:bg-zinc-200 ring-1 ring-zinc-200 text-zinc-700"
                  data-copy="${escapeHtml(`${ref} — ${v.texto}`)}">
            <i class="far fa-copy"></i> Copiar
          </button>
        </header>
        <p class="text-zinc-800 text-lg leading-relaxed">${escapeHtml(v.texto)}</p>
      </article>`;
  }

  function renderResultados(versos){
    const box = $("resultado");
    box.innerHTML = versos.map(cardVerso).join("");
    box.querySelectorAll(".copy-btn").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const txt = btn.getAttribute("data-copy")
          .replaceAll("&lt;","<").replaceAll("&gt;",">").replaceAll("&amp;","&")
          .replaceAll("&quot;","\"").replaceAll("&#039;","'");
        try {
          await navigator.clipboard.writeText(txt);
          toast("Verso copiado! ✨");
        } catch {
          // Fallback: seleciona o conteúdo como último recurso
          const ta = document.createElement("textarea");
          ta.value = txt;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          try { document.execCommand("copy"); toast("Verso copiado! ✨"); }
          catch { toast("Não foi possível copiar aqui. Selecione o texto e copie."); }
          finally { document.body.removeChild(ta); }
        }
      });
    });
  }

  /* --------------- Fetch helpers --------------- */
  function getJson(url){
    return fetch(url, { headers:{"Accept":"application/json"} })
      .then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); });
  }

  function normalizeVersos(data){
    let arr = [];
    if (Array.isArray(data)) arr = data;
    else if (Array.isArray(data?.versos)) arr = data.versos;
    else if (Array.isArray(data?.data)) arr = data.data;
    else if (data && typeof data === "object") arr = [data];

    return arr.map(x=>{
      const livro = x.livro ?? x.Livro ?? "";
      const cap   = x.capitulo ?? x.Capitulo ?? 0;
      const ver   = x.versiculo ?? x.Versiculo ?? "";
      const texto = x.texto ?? x.Texto ?? "";
      return { livro: String(livro), capitulo: Number(cap), versiculo: ver?.toString?.() ?? "", texto: String(texto) };
    }).filter(v => v.texto);
  }

  /* ------------------- Parsing ------------------ */
  function parseReferencia(str){
    if (!str) return null;
    const s = str.trim().replace(/\s+/g," ");
    const m = s.match(/^(.+?)\s+(\d+)(?::([\d,\-\s]+))?$/i);
    if (m) return { livro:m[1].trim(), capitulo:m[2].trim(), versiculo:(m[3]||"").replace(/\s+/g,"") };
    return { livro:s, capitulo:"", versiculo:"" };
  }

  /* ------------------- Actions ------------------ */
  async function buscarPorReferencia(refStr){
    const loading=$("loading"), res=$("resultado");
    clearMsg(); res.innerHTML=""; show(loading);
    try{
      const data   = await getJson(urlPorRef(refStr));
      const versos = normalizeVersos(data);
      hide(loading);
      if (!versos.length){ setMsg("warn","Nada encontrado para essa referência."); return; }
      renderResultados(versos);
    }catch{ hide(loading); setMsg("error","Erro ao buscar. Verifique a API/rota."); }
  }

  async function buscarPorCampos(){
    const livro = $("selectLivro")?.value?.trim();
    const cap   = $("inputCapitulo")?.value?.trim();
    const ver   = $("inputVersiculo")?.value?.trim();
    if (!livro){ setMsg("warn","Escolha um <strong>livro</strong> para continuar."); return; }

    const loading=$("loading"), res=$("resultado");
    clearMsg(); res.innerHTML=""; show(loading);
    try{
      const data   = await getJson(urlPorCampos(livro, cap||"", ver||""));
      const versos = normalizeVersos(data);
      hide(loading);
      if (!versos.length){ setMsg("warn","Nada encontrado com esses filtros."); return; }
      renderResultados(versos);
    }catch{ hide(loading); setMsg("error","Erro ao buscar. Confira parâmetros/endpoint."); }
  }

  async function carregarLivros(){
    const sel = $("selectLivro"); if (!sel) return;
    try{
      const lista = await getJson(urlListaLivros());
      if (Array.isArray(lista) && lista.length){
        sel.innerHTML = `<option value="">Selecione...</option>` +
          lista.map(n => `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`).join("");
        return;
      }
      throw new Error();
    }catch{
      const fallback=["Gênesis","Êxodo","Levítico","Números","Deuteronômio","Josué","Juízes","Rute","1 Samuel","2 Samuel","1 Reis","2 Reis","1 Crônicas","2 Crônicas","Esdras","Neemias","Ester","Jó","Salmos","Provérbios","Eclesiastes","Cantares","Isaías","Jeremias","Lamentações","Ezequiel","Daniel","Oséias","Joel","Amós","Obadias","Jonas","Miquéias","Naum","Habacuque","Sofonias","Ageu","Zacarias","Malaquias","Mateus","Marcos","Lucas","João","Atos","Romanos","1 Coríntios","2 Coríntios","Gálatas","Efésios","Filipenses","Colossenses","1 Tessalonicenses","2 Tessalonicenses","1 Timóteo","2 Timóteo","Tito","Filemom","Hebreus","Tiago","1 Pedro","2 Pedro","1 João","2 João","3 João","Judas","Apocalipse"];
      sel.innerHTML = `<option value="">Selecione...</option>` +
        fallback.map(n => `<option value="${n}">${n}</option>`).join("");
    }
  }

  /* ----------------- Safe layout ---------------- */
  function stripRefFromURL(){
    try{
      const u = new URL(location.href);
      if (u.searchParams.has("ref")){
        u.searchParams.delete("ref");
        history.replaceState({}, "", u);
      }
    }catch{}
  }

  /* ------------------- Binder ------------------- */
  function bindUI(){
    const root = $(ROOT_ID);
    if (!root) return;
    if (root.dataset.bound === "1") return;
    root.dataset.bound = "1";

    const btnBuscar  = $("btnBuscar");
    const btnLimparS = $("btnLimparSimples");
    const inpRef     = $("refInput");
    const tog        = $("toggleAvancado");
    const btnAv      = $("btnBuscarAv");
    const btnClearAv = $("btnLimparAv");

    const doBuscar = () => {
      const val = inpRef?.value?.trim();
      if (!val){ setMsg("warn","Digite uma referência, ex.: <strong>João 3:16</strong>."); return; }
      const p = parseReferencia(val);
      const ref = p.capitulo ? `${p.livro} ${p.capitulo}${p.versiculo?":"+p.versiculo:""}` : p.livro;
      buscarPorReferencia(ref);
    };

    on(btnBuscar, "click", doBuscar);
    on(inpRef, "keydown", (e) => { if (e.key === "Enter") doBuscar(); });

    // Limpar (busca rápida)
    on(btnLimparS, "click", () => {
      if (inpRef) inpRef.value = "";
      $("resultado").innerHTML = "";
      clearMsg();
      stripRefFromURL();
      inpRef?.focus();
    });

    on(tog, "click", () => { const a=$("areaAvancada"); if (a) a.classList.toggle("hidden"); });
    on(btnAv, "click", buscarPorCampos);
    on(btnClearAv, "click", () => {
      const s=$("selectLivro"), c=$("inputCapitulo"), v=$("inputVersiculo");
      if(s) s.value=""; if(c) c.value=""; if(v) v.value="";
      $("resultado").innerHTML=""; clearMsg();
    });

    carregarLivros();
    stripRefFromURL();
  }

  /* ------------- SPA: observar mount ------------- */
  function watchMount(){
    bindUI();
    const mo = new MutationObserver(() => {
      const root = $(ROOT_ID);
      if (root && root.dataset.bound !== "1") bindUI();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    on(window, "hashchange", bindUI);
    on(window, "popstate",  bindUI);
    on(window, "pageshow",  bindUI);
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", watchMount, { once:true });
  else
    watchMount();

  window.ProcureDescubra = { init: bindUI };
})();
