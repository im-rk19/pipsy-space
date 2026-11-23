
(function(){
  function el(tag, attrs, parent){var n=document.createElementNS('http://www.w3.org/2000/svg',tag);for(var k in attrs)n.setAttribute(k,attrs[k]);if(parent)parent.appendChild(n);return n;}
  function wrap(t,max){var w=t.split(' '),lines=[],cur='';w.forEach(function(x){if((cur+' '+x).trim().length>max){if(cur)lines.push(cur);cur=x;}else cur=(cur+' '+x).trim();});if(cur)lines.push(cur);return lines;}
  document.querySelectorAll('[data-mindmap]').forEach(function(host){
    var d=JSON.parse(host.getAttribute('data-mindmap'));
    var W=1440, rowH=40, gapB=18;
    var L=[],R=[]; d.branches.forEach(function(b,i){(i%2===0?R:L).push(b);});
    function sideH(s){return s.reduce(function(a,b){return a+Math.max(b.leaves.length,1)*rowH+gapB;},0)-gapB;}
    var H=Math.max(sideH(L),sideH(R))+60; H=Math.max(H,360);
    var svg=el('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':'Mind map: '+d.center});
    var cx=W/2, cy=H/2, bOff=245, lOff=395, bw=200, lw=250;
    var gL=el('g',{},svg), gN=el('g',{},svg), fix=[];
    function layout(side,dir){
      var y=(H-sideH(side))/2;
      side.forEach(function(b){
        var n=Math.max(b.leaves.length,1), top=y, by=top+(n*rowH)/2;
        var bx=cx+dir*bOff;
        el('path',{d:'M'+cx+','+cy+' C'+(cx+dir*120)+','+cy+' '+(bx-dir*140)+','+by+' '+(bx-dir*bw/2)+','+by,fill:'none',stroke:b.color,'stroke-width':3,'stroke-linecap':'round',opacity:.85},gL);
        b.leaves.forEach(function(lf,j){
          var ly=top+j*rowH+rowH/2, lx=cx+dir*lOff;
          el('path',{d:'M'+(bx+dir*bw/2)+','+by+' C'+(bx+dir*(bw/2+50))+','+by+' '+(lx-dir*50)+','+ly+' '+(lx)+','+ly,fill:'none',stroke:b.color,'stroke-width':1.5,opacity:.6},gL);
          var rx=dir>0?lx:lx-lw;
          el('rect',{x:rx,y:ly-15,width:lw,height:30,rx:8,fill:'var(--surface)',stroke:b.color,'stroke-opacity':.55},gN);
          var t=el('text',{x:rx+12,y:ly+5,'font-size':13.5},gN); t.textContent=lf; fix.push([t,gN.lastChild.previousSibling,dir,lx]);
        });
        var bl=wrap(b.label,22);
        var bh=Math.max(40,bl.length*18+16);
        var a=el(b.href?'a':'g',b.href?{href:b.href}:{},gN);
        el('rect',{x:bx-bw/2,y:by-bh/2,width:bw,height:bh,rx:10,fill:b.color},a);
        bl.forEach(function(s,k){var t=el('text',{x:bx,y:by-(bl.length-1)*9+k*18+5,'text-anchor':'middle','font-size':14.5,'font-weight':700,style:'fill:#fff'},a);t.textContent=s;});
        y+=n*rowH+gapB;
      });
    }
    layout(R,1); layout(L,-1);
    var cl=wrap(d.center,18), ch=cl.length*22+30;
    el('rect',{x:cx-105,y:cy-ch/2,width:210,height:ch,rx:16,fill:'var(--ink)'},gN);
    cl.forEach(function(s,k){var t=el('text',{x:cx,y:cy-(cl.length-1)*11+k*22+6,'text-anchor':'middle','font-size':17,'font-weight':700,style:'fill:var(--bg);font-family:var(--display)'},gN);t.textContent=s;});
    host.appendChild(svg);
    fix.forEach(function(f){var w=Math.min(Math.max(f[0].getComputedTextLength()+24,120),310);f[1].setAttribute('width',w);if(f[2]<0){f[1].setAttribute('x',f[3]-w);f[0].setAttribute('x',f[3]-w+12);}});
  });
})();
