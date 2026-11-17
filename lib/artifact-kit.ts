/**
 * Código que se incrusta en cada artefacto HTML/SVG (iframe aislado). Define
 * window.tutor: el puente con la clase, componentes de alto nivel para que el
 * diseñador no posicione a mano, y una revisión visual automática que informa
 * de solapamientos, recortes y errores para que el diseñador los corrija.
 * Es JavaScript clásico (ES2017) en una cadena: no se ejecuta en la app.
 */
export const artifactKit = String.raw`(function(){
"use strict";
var send=function(m){m.canal="tutor-artefacto";try{parent.postMessage(m,"*")}catch(e){}};
var errores=[];
window.addEventListener("error",function(e){var m=String(e.message||"error").slice(0,300);errores.push(m);send({tipo:"error",mensaje:m})});
window.addEventListener("unhandledrejection",function(e){var m=String((e.reason&&e.reason.message)||e.reason||"promesa rechazada").slice(0,300);errores.push(m)});
var $=function(x){return typeof x==="string"?document.querySelector(x):x};
var el=function(tag,attrs,text){var n=document.createElement(tag);for(var k in attrs||{})n.setAttribute(k,attrs[k]);if(text!=null)n.textContent=text;return n};
var reduce=window.matchMedia&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
var clamp=function(v,a,b){return Math.max(a,Math.min(b,v))};
var vistas=[];
var fmt=function(ms){var s=Math.round(ms/1000);return Math.floor(s/60)+":"+String(s%60).padStart(2,"0")};

var tutor={
  preguntar:function(t){send({tipo:"preguntar",texto:String(t||"").slice(0,500)})},
  estado:function(o){try{send({tipo:"estado",estado:JSON.parse(JSON.stringify(o||{}))})}catch(e){}},

  // Animación tipo video: escenas deterministas en función del progreso p (0..1).
  // Al dibujar el instante t se llama a las escenas pasadas con 1 y a la actual con p,
  // en orden; las futuras no se llaman. Sirve tanto si cada escena dibuja el estado
  // completo como si acumula cambios, y la barra puede saltar a cualquier punto.
  reproductor:function(o){
    var cont=$(o.contenedor)||document.body;
    var escenas=(o.escenas||[]).filter(function(s){return s&&s.duracion>0});
    if(!escenas.length)throw new Error("tutor.reproductor necesita escenas con duracion");
    var inicios=[],total=0;escenas.forEach(function(s){inicios.push(total);total+=s.duracion});
    var barra=el("div",{"class":"tk-reproductor",role:"group","aria-label":"Controles de la animación"});
    var boton=el("button",{"class":"primario tk-play",type:"button"},"▶ Reproducir");
    var reiniciar=el("button",{type:"button","aria-label":"Volver al inicio"},"↺");
    var rango=el("input",{type:"range",min:"0",max:String(total),step:"10",value:"0","aria-label":"Posición de la animación"});
    var tiempo=el("span",{"class":"etiqueta tk-tiempo"});
    var sub=el("div",{"class":"tk-subtitulo","aria-live":"polite"});
    barra.append(boton,reiniciar,rango,tiempo);cont.append(barra,sub);
    var t=0,jugando=false,ultimo=0,actual=-1,raf=0;
    function pintar(){
      var i=0;while(i<escenas.length-1&&t>=inicios[i+1])i++;
      for(var k=0;k<=i;k++){var s=escenas[k],p=k<i?1:clamp((t-inicios[k])/s.duracion,0,1);try{s.dibujar&&s.dibujar(p,k)}catch(e){errores.push(String(e.message));throw e}}
      rango.value=String(Math.round(t));tiempo.textContent=fmt(t)+" / "+fmt(total);
      if(i!==actual){actual=i;sub.innerHTML="";sub.append(el("b",{},"Escena "+(i+1)+" de "+escenas.length+". "),document.createTextNode(escenas[i].subtitulo||""));tutor.estado({escena:i+1,escenas:escenas.length,reproduciendo:jugando,segundo:Math.round(t/1000)})}
    }
    function paso(ahora){if(!jugando)return;t=clamp(t+(ahora-ultimo),0,total);ultimo=ahora;pintar();if(t>=total){if(o.bucle){t=0}else{pausar();o.alTerminar&&o.alTerminar();return}}raf=requestAnimationFrame(paso)}
    function reproducir(){if(t>=total)t=0;jugando=true;boton.textContent="❚❚ Pausa";ultimo=performance.now();raf=requestAnimationFrame(paso);tutor.estado({escena:actual+1,escenas:escenas.length,reproduciendo:true})}
    function pausar(){jugando=false;cancelAnimationFrame(raf);boton.textContent=t>=total?"↻ Ver de nuevo":"▶ Reproducir";tutor.estado({escena:actual+1,escenas:escenas.length,reproduciendo:false,segundo:Math.round(t/1000)})}
    function ir(ms){t=clamp(ms,0,total);pintar()}
    boton.onclick=function(){jugando?pausar():reproducir()};
    reiniciar.onclick=function(){pausar();ir(0)};
    rango.oninput=function(){pausar();ir(Number(rango.value))};
    vistas.push({nombre:"la escena",total:escenas.length,ir:function(k){pausar();ir(inicios[k]+escenas[k].duracion*0.999)},volver:function(){ir(0)}});
    ir(0);if(o.autoplay&&!reduce)reproducir();
    return {reproducir:reproducir,pausar:pausar,ir:ir,duracion:total};
  },

  // Recorrido paso a paso: mostrar(activo, actual) se llama para cada paso al cambiar.
  pasos:function(o){
    var cont=$(o.contenedor)||document.body;var lista=o.pasos||[];var i=clamp(o.inicio||0,0,lista.length-1);
    var nav=el("div",{"class":"tk-pasos",role:"group","aria-label":"Pasos"});
    var ant=el("button",{type:"button"},"← Anterior");var sig=el("button",{"class":"primario",type:"button"},"Siguiente →");
    var puntos=el("div",{"class":"tk-puntos"});var texto=el("div",{"class":"tk-paso-texto","aria-live":"polite"});
    lista.forEach(function(_,k){var b=el("button",{type:"button","aria-label":"Ir al paso "+(k+1)},String(k+1));b.onclick=function(){ir(k)};puntos.append(b)});
    nav.append(ant,puntos,sig);cont.append(nav,texto);
    function ir(k){i=clamp(k,0,lista.length-1);lista.forEach(function(p,j){try{p.mostrar&&p.mostrar(j<=i,j===i)}catch(e){errores.push(String(e.message));throw e}});
      ant.disabled=i===0;sig.disabled=i===lista.length-1;Array.prototype.forEach.call(puntos.children,function(b,j){b.className=j===i?"activo":j<i?"hecho":""});
      texto.innerHTML="";texto.append(el("b",{},lista[i].titulo||("Paso "+(i+1))));if(lista[i].texto)texto.append(el("p",{},lista[i].texto));
      tutor.estado({paso:i+1,pasos:lista.length,titulo:String(lista[i].titulo||"").slice(0,120)})}
    var inicial=i;vistas.push({nombre:"el paso",total:lista.length,ir:ir,volver:function(){ir(inicial)}});
    ant.onclick=function(){ir(i-1)};sig.onclick=function(){ir(i+1)};ir(i);
    return {ir:ir};
  },

  // Flecha entre dos elementos HTML dentro de un contenedor; se recalcula al redimensionar.
  conectar:function(contenedor,desde,hacia,op){
    var cont=$(contenedor),a=$(desde),b=$(hacia);op=op||{};
    if(!cont||!a||!b)throw new Error("tutor.conectar: no encuentro el contenedor o los elementos");
    if(getComputedStyle(cont).position==="static")cont.style.position="relative";
    var capa=cont.querySelector(":scope > svg.tk-capa");
    if(!capa){capa=document.createElementNS("http://www.w3.org/2000/svg","svg");capa.setAttribute("class","tk-capa");capa.setAttribute("aria-hidden","true");cont.prepend(capa);capa.__lineas=[];
      new ResizeObserver(function(){capa.__lineas.forEach(function(f){f()})}).observe(cont)}
    var ns="http://www.w3.org/2000/svg",color=op.color||"var(--tutor-purple)";
    var g=document.createElementNS(ns,"g"),linea=document.createElementNS(ns,"path"),fondo=document.createElementNS(ns,"rect"),txt=document.createElementNS(ns,"text");
    var id="tk-f"+Math.random().toString(36).slice(2,8),defs=document.createElementNS(ns,"defs"),m=document.createElementNS(ns,"marker");
    m.setAttribute("id",id);m.setAttribute("viewBox","0 0 10 10");m.setAttribute("refX","9");m.setAttribute("refY","5");m.setAttribute("markerWidth","7");m.setAttribute("markerHeight","7");m.setAttribute("orient","auto-start-reverse");
    var punta=document.createElementNS(ns,"path");punta.setAttribute("d","M0,0 L10,5 L0,10 z");punta.setAttribute("fill",color);m.append(punta);defs.append(m);
    linea.setAttribute("fill","none");linea.setAttribute("stroke",color);linea.setAttribute("stroke-width",op.grosor||2);linea.setAttribute("marker-end","url(#"+id+")");if(op.doble)linea.setAttribute("marker-start","url(#"+id+")");if(op.discontinua)linea.setAttribute("stroke-dasharray","6 5");
    fondo.setAttribute("fill","white");fondo.setAttribute("rx","4");txt.setAttribute("font-size","12.5");txt.setAttribute("fill",color);txt.setAttribute("text-anchor","middle");txt.setAttribute("dominant-baseline","middle");
    g.append(defs,linea);if(op.etiqueta){txt.textContent=op.etiqueta;g.append(fondo,txt)}capa.append(g);
    function dibujar(){var c=cont.getBoundingClientRect(),r1=a.getBoundingClientRect(),r2=b.getBoundingClientRect();
      var x1,y1,x2,y2,d,h=Math.abs((r1.left+r1.right)/2-(r2.left+r2.right)/2)>=Math.abs((r1.top+r1.bottom)/2-(r2.top+r2.bottom)/2);
      if(h){var der=r2.left>=r1.right-1;x1=(der?r1.right:r1.left)-c.left;x2=(der?r2.left:r2.right)-c.left;var top=Math.max(r1.top,r2.top),bot=Math.min(r1.bottom,r2.bottom);
        if(bot-top>8){y1=y2=(top+bot)/2-c.top;d="M"+x1+","+y1+" L"+x2+","+y2}else{y1=(r1.top+r1.bottom)/2-c.top;y2=(r2.top+r2.bottom)/2-c.top;var xm=(x1+x2)/2;d="M"+x1+","+y1+" L"+xm+","+y1+" L"+xm+","+y2+" L"+x2+","+y2}}
      else{var abajo=r2.top>=r1.bottom-1;y1=(abajo?r1.bottom:r1.top)-c.top;y2=(abajo?r2.top:r2.bottom)-c.top;var l=Math.max(r1.left,r2.left),rr=Math.min(r1.right,r2.right);
        if(rr-l>8){x1=x2=(l+rr)/2-c.left;d="M"+x1+","+y1+" L"+x2+","+y2}else{x1=(r1.left+r1.right)/2-c.left;x2=(r2.left+r2.right)/2-c.left;var ym=(y1+y2)/2;d="M"+x1+","+y1+" L"+x1+","+ym+" L"+x2+","+ym+" L"+x2+","+y2}}
      linea.setAttribute("d",d);
      if(op.etiqueta){var mx=(x1+x2)/2,my=(y1+y2)/2,hueco=h?Math.abs(x2-x1):Infinity;rotular(mx,my,Math.max(56,Math.min(160,hueco-10)))}}
    // Parte la etiqueta en líneas para que quepa en el hueco entre las cajas.
    function rotular(mx,my,maximo){txt.textContent="";var palabras=String(op.etiqueta).split(/\s+/),lineas=[],actual="";
      palabras.forEach(function(w){var prueba=actual?actual+" "+w:w;txt.textContent=prueba;if(actual&&txt.getComputedTextLength()>maximo){lineas.push(actual);actual=w}else actual=prueba});if(actual)lineas.push(actual);
      txt.textContent="";lineas.forEach(function(l,k){var t=document.createElementNS(ns,"tspan");t.setAttribute("x",mx);t.setAttribute("dy",k===0?(-(lineas.length-1)*0.6)+"em":"1.2em");t.textContent=l;txt.append(t)});
      txt.setAttribute("x",mx);txt.setAttribute("y",my);var bb=txt.getBBox();fondo.setAttribute("x",bb.x-4);fondo.setAttribute("y",bb.y-2);fondo.setAttribute("width",bb.width+8);fondo.setAttribute("height",bb.height+4)}
    capa.__lineas.push(dibujar);requestAnimationFrame(dibujar);return {redibujar:dibujar};
  }
};
window.tutor=tutor;

// ---- Revisión visual: se ejecuta al cargar e informa al marco de la app ----
function visible(n){var s=getComputedStyle(n);return s.display!=="none"&&s.visibility!=="hidden"&&Number(s.opacity)>0.05}
function nombre(n){var t=(n.textContent||"").replace(/\s+/g," ").trim().slice(0,40);return t?"«"+t+"»":"<"+n.tagName.toLowerCase()+(n.id?"#"+n.id:"")+">"}
function textos(){var r=[];
  document.querySelectorAll("text").forEach(function(n){if(!n.closest("defs")&&!n.closest(".tk-capa")&&(n.textContent||"").trim())r.push(n)});
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT,{acceptNode:function(t){var p=t.parentElement;if(!p||!t.textContent.trim()||/^(SCRIPT|STYLE|OPTION|TEXT|TSPAN)$/i.test(p.tagName)||p.closest("svg"))return NodeFilter.FILTER_REJECT;return NodeFilter.FILTER_ACCEPT}});
  var vistos=new Set();while(w.nextNode()){var p=w.currentNode.parentElement;if(!vistos.has(p)){vistos.add(p);r.push(p)}}
  return r.filter(function(n){var rc=n.getBoundingClientRect();return rc.width>2&&rc.height>2&&visible(n)})}
function tamano(n){var f=parseFloat(getComputedStyle(n).fontSize)||15;var svg=n instanceof SVGElement&&n.closest("svg");
  if(svg&&svg.viewBox&&svg.viewBox.baseVal&&svg.viewBox.baseVal.width){var r=svg.getBoundingClientRect();f*=r.width/svg.viewBox.baseVal.width}return f}
function escala(){var d=[];document.querySelectorAll("svg").forEach(function(s){if(s.closest(".tk-capa")||!s.viewBox||!s.viewBox.baseVal||!s.viewBox.baseVal.width)return;var r=s.getBoundingClientRect();if(r.width<40)return;
  d.push("un SVG con viewBox de "+Math.round(s.viewBox.baseVal.width)+" unidades de ancho se dibuja a "+Math.round(r.width)+" px (1 unidad = "+(r.width/s.viewBox.baseVal.width).toFixed(2)+" px)")});return d.slice(0,2).join("; ")}
function chequear(prefijo){
  var problemas=[],raiz=document.documentElement,W=raiz.clientWidth,H=window.innerHeight,p=function(m){problemas.push(prefijo+m)};
  if(raiz.scrollWidth>W+2)p("El contenido mide "+raiz.scrollWidth+" px de ancho y el marco "+W+" px: elimina anchos fijos y usa width:100%, max-width o viewBox.");
  document.querySelectorAll("body *").forEach(function(n){if(n.closest(".tk-capa"))return;var s=getComputedStyle(n);
    if(/(auto|scroll)/.test(s.overflowY+s.overflowX)&&(n.scrollHeight>n.clientHeight+4||n.scrollWidth>n.clientWidth+4))p("El contenedor "+nombre(n)+" tiene scroll propio: deja que el contenido crezca o reduce su tamaño.")});
  var lista=textos(),rects=lista.map(function(n){return n.getBoundingClientRect()}),pequenos=[];
  lista.forEach(function(n,i){var r=rects[i],q=nombre(n),f=tamano(n);
    if(f<11.5)pequenos.push(q+" a "+f.toFixed(1)+" px");
    if(r.right>W+1||r.left<-1){p("El texto "+q+" se sale por el borde del marco.");return}
    var svg=n instanceof SVGElement&&n.closest("svg");if(svg){var s=svg.getBoundingClientRect();if(r.left<s.left-1||r.right>s.right+1||r.top<s.top-1||r.bottom>s.bottom+1){p("El texto "+q+" se sale del área del dibujo SVG: amplía el viewBox o recoloca el texto.");return}}
    for(var j=i+1;j<lista.length;j++){var m=lista[j],o=rects[j];if(n.contains(m)||m.contains(n))continue;
      var ancho=Math.min(r.right,o.right)-Math.max(r.left,o.left),alto=Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top);
      if(ancho>2&&alto>2&&ancho*alto>0.12*Math.min(r.width*r.height,o.width*o.height))p("Los textos "+q+" y "+nombre(m)+" se superponen: sepáralos o recoloca uno.")}
    var tapa=null,tapados=0;[0.1,0.3,0.5,0.7,0.9].forEach(function(k){var x=r.left+r.width*k,y=r.top+r.height*0.5;if(y<0||y>H)return;var top=document.elementFromPoint(x,y);
      if(top&&top!==n&&!n.contains(top)&&!top.contains(n)&&lista.indexOf(top)<0){tapados++;tapa=top}});
    if(tapados>=2)p("El texto "+q+" queda tapado por "+nombre(tapa)+": dibuja el texto encima o muévelo fuera de la figura.")});
  document.querySelectorAll(".tk-capa text").forEach(function(e){var partes=e.querySelectorAll("tspan"),etiqueta=(partes.length?Array.prototype.map.call(partes,function(t){return t.textContent}).join(" "):e.textContent||"").trim();if(!etiqueta)return;var r=e.getBoundingClientRect();if(r.width<2)return;
    lista.forEach(function(n,i){var o=rects[i],ancho=Math.min(r.right,o.right)-Math.max(r.left,o.left),alto=Math.min(r.bottom,o.bottom)-Math.max(r.top,o.top);
      if(ancho>2&&alto>2)p("La etiqueta de flecha «"+etiqueta.slice(0,40)+"» se superpone con el texto "+nombre(n)+": aumenta la separación (gap ≥ 140 px) entre las cajas que une o acorta la etiqueta a 1-2 palabras.")})});
  if(pequenos.length){var e=escala();p(pequenos.length+" textos se ven demasiado pequeños (mínimo 12 px en pantalla), p. ej. "+pequenos.slice(0,3).join(", ")+". El marco mide "+W+" px"+(e?"; "+e:"")+". Haz que el dibujo ocupe todo el ancho del marco (no en una columna estrecha) y elige viewBox y font-size para que font-size × escala ≥ 13 px.")}
  return problemas}
// Huella del contenido visible (sin los controles del kit) para saber si algo cambia.
function huella(){var c=document.body.cloneNode(true);c.querySelectorAll(".tk-reproductor,.tk-subtitulo,.tk-pasos,.tk-paso-texto,script").forEach(function(n){n.remove()});return c.innerHTML}
function revisar(){
  var problemas=chequear("");
  vistas.forEach(function(v){var huellas=[];for(var k=0;k<v.total;k++){try{v.ir(k);huellas.push(huella());problemas=problemas.concat(chequear("En "+v.nombre+" "+(k+1)+": "))}catch(e){problemas.push("Error de JavaScript en "+v.nombre+" "+(k+1)+": "+e.message)}}try{v.volver()}catch(e){}
    if(huellas.length>1&&huellas.every(function(h){return h===huellas[0]}))problemas.unshift("La animación no cambia: el dibujo es idéntico en todas las escenas ("+v.total+"). Cada dibujar(p) debe modificar de verdad el SVG o el HTML visible (atributos, estilos, textos o posiciones).")
    else if(huellas.length>2&&huellas.slice(1).every(function(h){return h===huellas[1]}))problemas.unshift("Solo la primera escena se ve distinta; de la "+2+" en adelante el dibujo no cambia. Revisa que cada dibujar(p) actualice lo que muestra su escena.")});
  errores.slice(0,3).forEach(function(m){problemas.push("Error de JavaScript: "+m)});
  if(!document.body.innerText.trim()&&!document.querySelector("svg,canvas"))problemas.push("El artefacto no muestra contenido.");
  // Quita repeticiones: un mismo problema en varias escenas se informa una vez.
  var vistos={},unicos=[];problemas.forEach(function(m){var clave=m.replace(/^En (la escena|el paso) \d+: /,"");if(!vistos[clave]){vistos[clave]=1;unicos.push(m)}});
  send({tipo:"revision",problemas:unicos.slice(0,12)});
}
var medir=function(){send({tipo:"altura",altura:Math.ceil(document.documentElement.scrollHeight)})};
// Solo el iframe oculto de revisión recorre escenas y pasos; el visible no se altera.
window.addEventListener("load",function(){medir();if(!window.TUTOR_REVISION)return;setTimeout(function(){try{revisar()}catch(e){send({tipo:"revision",problemas:["No se pudo revisar: "+e.message]})}},700)});
new ResizeObserver(medir).observe(document.documentElement);
})();`;

/** Estilos del kit, añadidos a los estilos base del iframe. */
export const artifactKitStyles = `
.tk-capa{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:2}
.tk-reproductor{display:flex;align-items:center;gap:10px;margin-top:14px}
.tk-reproductor input[type=range]{flex:1}
.tk-tiempo{min-width:78px;text-align:right;font-variant-numeric:tabular-nums}
.tk-subtitulo{margin-top:10px;padding:10px 14px;border-radius:10px;background:var(--tutor-surface);min-height:44px}
.tk-pasos{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px}
.tk-puntos{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.tk-puntos button{width:30px;height:30px;padding:0;border-radius:50%}
.tk-puntos button.activo{background:var(--tutor-purple);border-color:var(--tutor-purple);color:#fff}
.tk-puntos button.hecho{background:var(--tutor-purple-soft)}
.tk-paso-texto{margin-top:10px;padding:10px 14px;border-radius:10px;background:var(--tutor-surface)}
.tk-paso-texto p{margin:4px 0 0}`;
