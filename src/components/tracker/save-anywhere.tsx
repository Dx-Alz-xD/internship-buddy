"use client";

import { Bookmark, MousePointerClick } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/**
 * The bookmarklet runs on any job page. It reads the page's JobPosting data (most career sites,
 * LinkedIn and Naukri publish it for search engines), plus the title, URL and any selected text,
 * then opens /save in a small window. Nothing is sent anywhere except this app.
 */
function bookmarklet(origin: string) {
  const code = `(()=>{let j={};try{for(const s of document.querySelectorAll('script[type="application/ld+json"]')){let d=JSON.parse(s.textContent);d=[].concat(d['@graph']||d);const p=d.find(x=>x&&[].concat(x['@type']).includes('JobPosting'));if(p){const h=v=>v?String(v).replace(/<[^>]+>/g,' ').replace(/\\s+/g,' ').trim():'';j={t:p.title,o:(p.hiringOrganization||{}).name,l:JSON.stringify(p.jobLocation||p.applicantLocationRequirements||'').slice(0,300),v:p.validThrough,s:JSON.stringify(p.baseSalary||'').slice(0,200),e:String(p.employmentType||''),d:h(p.description).slice(0,2500)};break}}}catch(e){}const m=n=>(document.querySelector('meta[property="'+n+'"]')||{}).content||'';const q=new URLSearchParams({url:location.href,title:m('og:title')||document.title,site:m('og:site_name')||location.hostname,sel:String(getSelection()).slice(0,2000),text:j.d?'':document.body.innerText.replace(/\\s+/g,' ').slice(0,2500),ld:JSON.stringify(j)});open('${origin}/save?'+q,'ib_save','width=520,height=780')})();`;
  return `javascript:${code}`;
}

export function SaveAnywhere() {
  const link = useRef<HTMLAnchorElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // React refuses javascript: URLs in href, so the bookmarklet is attached directly.
    if (open) setTimeout(() => link.current?.setAttribute("href", bookmarklet(window.location.origin)), 0);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Bookmark /> Save from any site
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display-wide text-xl font-extrabold">Save jobs from any website</DialogTitle>
          <DialogDescription>
            A bookmark button that adds the job you are looking at, on any site (company career pages, LinkedIn, Naukri, Wellfound), to this tracker.
          </DialogDescription>
        </DialogHeader>
        <ol className="space-y-4 text-sm">
          <li className="flex gap-3">
            <span className="font-mono text-xs font-semibold text-stamp">1</span>
            <div className="space-y-2">
              <p>Show your bookmarks bar (Ctrl + Shift + B, or Cmd + Shift + B on a Mac).</p>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-xs font-semibold text-stamp">2</span>
            <div className="space-y-2">
              <p>Drag this button onto the bookmarks bar:</p>
              <a
                ref={link}
                onClick={(e) => e.preventDefault()}
                className="font-stamp inline-flex -rotate-2 cursor-grab items-center gap-2 rounded-md border-2 border-stamp bg-stamp-soft px-3 py-2 text-sm text-stamp shadow-sm active:cursor-grabbing"
              >
                <MousePointerClick className="size-4" /> + Internship Buddy
              </a>
            </div>
          </li>
          <li className="flex gap-3">
            <span className="font-mono text-xs font-semibold text-stamp">3</span>
            <p>On any job page, click the bookmark. A small window opens with the role, company and deadline filled in. Select text on the page first to save it as a note.</p>
          </li>
        </ol>
        <p className="text-xs text-muted-foreground">
          The bookmark only reads the page you click it on, and only sends it to this app. It works best on sites that publish job details for Google, which most career pages do.
        </p>
      </DialogContent>
    </Dialog>
  );
}
