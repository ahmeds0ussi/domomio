import { getServerUrl } from '../../../core/config/api.config';
import { AssetUrlPipe } from '../../../shared/pipes/asset-url.pipe';
import { Component, OnInit, AfterViewInit, HostListener, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AnnonceService } from '../../../core/services/annonce.service';
import { AuthService } from '../../../core/services/auth.service';
import { ContactService } from '../../../core/services/contact.service';
import { TranslateService } from '../../../core/services/translate.service';
import { TranslatePipe } from '../../../core/pipes/translate.pipe';
import { DOMOMIO_SERVICES } from '../../../core/config/services.config';
import * as L from 'leaflet';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslatePipe, AssetUrlPipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('heroVideo') heroVideo!: ElementRef;

  annonces: any[] = [];
  loading = true;
  navScrolled = false;
  private homeMap: L.Map | null = null;
  heroParallaxOffset = 0;
  currentSection = 'home';
  mobileMenuOpen = false;
  dropdownOpen = false;
  langDropdownOpen = false;
  user: any = null;
  revealObserver?: IntersectionObserver;

  counters = {
    annonces: 0,
    vendeurs: 0,
    gouvernorats: 0,
    satisfaction: 0
  };

  private readonly targetCounters = {
    annonces: 2500,
    vendeurs: 1200,
    gouvernorats: 24,
    satisfaction: 98
  };

  recherche = {
    type_bien: '',
    gouvernorat: '',
    type_transaction: 'vente'
  };

  contactForm = {
    nom: '',
    email: '',
    sujet: '',
    message: ''
  };
  contactEnvoi = false;
  contactSucces = false;
  contactErreur = '';

  gouvernorats = [
    'Ariana', 'Béja', 'Ben Arous', 'Bizerte', 'Gabès',
    'Gafsa', 'Jendouba', 'Kairouan', 'Kasserine', 'Kébili',
    'Kef', 'Mahdia', 'Manouba', 'Médenine', 'Monastir',
    'Nabeul', 'Sfax', 'Sidi Bouzid', 'Siliana', 'Sousse',
    'Tataouine', 'Tozeur', 'Tunis', 'Zaghouan'
  ];

  services = DOMOMIO_SERVICES;

  constructor(
    private annonceService: AnnonceService,
    private authService: AuthService,
    private contactService: ContactService,
    public translate: TranslateService,
    private router: Router
  ) {}

  @HostListener('window:scroll')
  onScroll() {
    this.navScrolled = window.scrollY > 50;
    this.heroParallaxOffset = Math.min(window.scrollY * 0.18, 90);
    this.updateActiveSection();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event) {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-menu')) this.dropdownOpen = false;
    if (!target.closest('.lang-globe')) this.langDropdownOpen = false;
  }

  ngOnInit() {
    this.user = this.authService.getCurrentUser();
    this.chargerAnnonces();
  }

  ngAfterViewInit() {
    const video = this.heroVideo?.nativeElement;
    if (video) {
      video.muted = true;
      video.play().catch(() => {});
    }
    this.setupRevealAnimations();
    this.updateActiveSection();
  }

  ngOnDestroy(): void {
    this.revealObserver?.disconnect();
    if (this.homeMap) { try { this.homeMap.remove(); } catch {} this.homeMap = null; }
  }

  chargerAnnonces() {
    this.annonceService.getAnnonces({ limite: 50 }).subscribe({
      next: (res: any) => {
        if (res.success) {
          this.annonces = res.data.annonces || [];
        }
        this.loading = false;
        setTimeout(() => {
          this.setupRevealAnimations();
          this.initHomeMap();
        }, 0);
      },
      error: () => { this.loading = false; }
    });
  }

  private initHomeMap() {
    const el = document.getElementById('home-map');
    if (!el) return;
    if (this.homeMap) { try { this.homeMap.remove(); } catch {} this.homeMap = null; }

    this.homeMap = L.map('home-map', { zoomControl: true, scrollWheelZoom: false })
      .setView([36.8065, 10.1815], 7);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(this.homeMap);

    const avecCoords = this.annonces.filter(a => a.latitude && a.longitude);

    avecCoords.forEach(a => {
      const icon = L.divIcon({
        html: `<div class="map-pin-marker"></div>`,
        iconSize: [22, 32],
        iconAnchor: [11, 32],
        className: ''
      });

      const imgHtml = a.medias?.length
        ? `<img src="${getServerUrl()}/${a.medias[0].url_fichier}" class="hmp-img" />`
        : `<div class="hmp-no-img"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg></div>`;

      const prix = Number(a.prix).toLocaleString('fr-TN');
      const typeBadge = a.type_transaction === 'vente' ? 'Vente' : a.type_transaction === 'location' ? 'Location' : 'Vacances';

      const popup = `
        <div class="hmp-popup">
          <div class="hmp-media">${imgHtml}<span class="hmp-badge">${typeBadge}</span></div>
          <div class="hmp-body">
            <div class="hmp-price">${prix} <small>DT</small></div>
            <div class="hmp-title">${a.titre}</div>
            <div class="hmp-loc">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${a.ville}, ${a.gouvernorat}
            </div>
            <a href="/annonces/${a.id}" class="hmp-btn">Voir le bien →</a>
          </div>
        </div>`;

      L.marker([a.latitude, a.longitude], { icon })
        .addTo(this.homeMap!)
        .bindPopup(popup, { maxWidth: 240, className: 'hmp-popup-wrap' });
    });
  }

  envoyerContact() {
    this.contactErreur = '';
    const { nom, email, sujet, message } = this.contactForm;
    if (!nom.trim() || !email.trim() || !sujet.trim() || !message.trim()) {
      this.contactErreur = 'Veuillez remplir tous les champs.';
      return;
    }
    this.contactEnvoi = true;
    this.contactService.envoyerMessage(this.contactForm).subscribe({
      next: () => {
        this.contactSucces = true;
        this.contactEnvoi = false;
        this.contactForm = { nom: '', email: '', sujet: '', message: '' };
      },
      error: (err) => {
        this.contactErreur = err?.error?.message || 'Une erreur est survenue. Veuillez réessayer.';
        this.contactEnvoi = false;
      }
    });
  }

  rechercher() {
    this.router.navigate(['/annonces'], { queryParams: this.recherche });
  }

  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  toggleDropdown() {
    this.dropdownOpen = !this.dropdownOpen;
  }

  getDashboardRoute(): string {
    const role = this.authService.getRole();
    if (role === 'admin') return '/admin/dashboard';
    if (role === 'vendeur') return '/vendeur/dashboard';
    else
      return '/acheteur/dashboard';
  }

  deconnexion() {
    this.authService.deconnexion();
    this.user = null;
    this.dropdownOpen = false;
    this.router.navigate(['/']);
  }

  getInitiales(): string {
    if (!this.user) return '';
    return (this.user.prenom?.charAt(0) || '') + (this.user.nom?.charAt(0) || '');
  }

  private setupRevealAnimations(): void {
    const elements = document.querySelectorAll<HTMLElement>('[data-reveal]');
    if (!elements.length) return;

    if (!this.revealObserver) {
      this.revealObserver = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            const element = entry.target as HTMLElement;
            element.classList.add('is-visible');

            if (element.dataset['counter'] === 'true') {
              this.animateCounters();
            }
            this.revealObserver?.unobserve(element);
          }
        },
        { threshold: 0.2, rootMargin: '0px 0px -10% 0px' }
      );
    }

    elements.forEach(el => {
      if (el.dataset['observed'] === 'true') return;
      el.dataset['observed'] = 'true';
      this.revealObserver?.observe(el);
    });
  }

  private animateCounters(): void {
    const start = performance.now();
    const duration = 1400;

    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = easeOutCubic(progress);

      this.counters = {
        annonces: Math.floor(this.targetCounters.annonces * eased),
        vendeurs: Math.floor(this.targetCounters.vendeurs * eased),
        gouvernorats: Math.floor(this.targetCounters.gouvernorats * eased),
        satisfaction: Math.floor(this.targetCounters.satisfaction * eased)
      };

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    };

    requestAnimationFrame(tick);
  }

  private updateActiveSection(): void {
    const sections = ['home', 'about', 'services', 'contact'];
    const offset = window.scrollY + 140;
    let active = 'home';

    for (const id of sections) {
      const section = id === 'home' ? document.querySelector('.hero') : document.getElementById(id);
      if (!section) continue;
      const top = (section as HTMLElement).offsetTop;
      if (offset >= top) active = id;
    }

    this.currentSection = active;
  }
}


