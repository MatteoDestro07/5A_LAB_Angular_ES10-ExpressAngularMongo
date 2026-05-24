import {ChangeDetectorRef, Component, OnInit} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import {Auth} from '../../services/auth';
import {Httpcall} from '../../services/httpcall';
import {Router} from '@angular/router';
import { Student } from '../../models/student.model';

@Component({
  selector: 'students',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './students.html',
  styleUrls: ['./students.css'],
})
export class Students implements OnInit {
  constructor(private auth:Auth, private http:Httpcall,private router:Router,private cdr:ChangeDetectorRef) {  }
  loading:boolean=false;
  errorMessage: string = "";
  successMessage: string = "";
  students: Student[] = [];
  showStats: boolean=false;
  filtroCognome: string = "";
  showForm: boolean=false;
  isEditing: boolean=false;
  studenteSelezionato: Student | null = null;
  formData: any = {};
  interessiString: string = "";
  corsiString: string = "";
  statistiche: any = {};

  ngOnInit() {
    // All'avvio della pagina carico subito la lista completa degli studenti.
    this.loadAll();
  }

  loadAll(){
    // Resetto lo stato di errore e mostro il caricamento mentre arriva la risposta.
    this.loading=true;
    this.errorMessage="";
    this.http.getCall('/api/students').subscribe({
      next: (res) =>{
        // Salvo il nuovo token ricevuto e aggiorno la lista in memoria.
        this.auth.saveToken(res.newToken);
        this.students=res.data;
        console.log(this.students);
        this.loading=false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading=false;
        this.errorMessage="Errore nel caricamento degli studenti";
        this.cdr.detectChanges();
      }
    });
  }

  caricaStatistiche() {
    // La pipeline MongoDB raggruppa gli studenti per città e conta quanti ce ne sono.
    // Uso un fallback per coprire sia "città" con accento sia la variante senza accento.
    const pipeline = [
      { $group: { _id: { $ifNull: ["$indirizzo.città", "$indirizzo.citta"] }, totale: { $sum: 1 } } },
      { $sort: { totale: -1 } }
    ];
    this.http.postCall('/api/students/statistiche', pipeline).subscribe({
      next: (res) => {
        // Aggiorno il token e salvo l'array delle statistiche da mostrare nel template.
        this.auth.saveToken(res.newToken);
        this.statistiche = res.data || [];
        this.showStats = true;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = "Errore nel caricamento delle statistiche";
        this.cdr.detectChanges();
      }
    });
  }

  logout() {
    // Logout applicativo e ritorno alla schermata di login.
    this.auth.logout();
    this.router.navigate(["/login"]);
  }

  cerca(){
    // Filtra gli studenti in base al cognome inserito nella barra di ricerca.
    this.http.postCall('/api/students/cercaPerCognome',{cognome:this.filtroCognome}).subscribe({
      next: (res) =>{
        this.auth.saveToken(res.newToken);
        this.students=res.data;
        console.log(this.students);
        this.cdr.detectChanges();
      }
    });
  }

  nuovoStudente(){
    // Preparo un form vuoto per inserire un nuovo studente.
    this.isEditing = false;
    this.formData = { nome: '', cognome: '', eta: null, indirizzo: { via: '', citta: '', CAP: '' }, interessi: [], corsi: [] };
    this.interessiString = '';
    this.corsiString = '';
    this.showForm = true;
  }

  modificaStudente(s: Student){
    // Clono lo studente selezionato per modificare i dati senza alterare subito la lista.
    this.isEditing = true;
    this.formData = JSON.parse(JSON.stringify(s));
    this.studenteSelezionato = { ...s };
    this.interessiString = (s.interessi && s.interessi.length) ? s.interessi.join(', ') : '';
    if (s.corsi && s.corsi.length) {
      this.corsiString = s.corsi.map(c => `${c.nome}:${c.voto}`).join(', ');
    } else {
      this.corsiString = '';
    }
    this.showForm = true;
  }

  salva(){
    // Se sono in modifica aggiorno lo studente esistente, altrimenti inserisco un nuovo record.
    if(this.isEditing){
      console.log('Saving student payload:', this.formData);
      if (this.isEditing && this.studenteSelezionato) {
        // Rimuovo eventuali campi tecnici prima di mandare il payload al server.
        const dati: any = { ...this.formData };
        if (dati._id) delete dati._id;
        if (dati.__v) delete dati.__v;
        if (dati.id) delete dati.id;
        const body = { nome: this.studenteSelezionato.nome, cognome: this.studenteSelezionato.cognome, dati };
        this.http.postCall('/api/students/modifica', body).subscribe({
          next: (res) =>{
            this.auth.saveToken(res.newToken);
            this.successMessage = "Studente modificato con successo";
            this.loadAll();
            this.showForm = false;
            this.isEditing = false;
            this.studenteSelezionato = null;
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = "Errore nella modifica dello studente";
            this.cdr.detectChanges();
          }
        });
      } else {
        const payload: any = { ...this.formData };
        if (payload._id) delete payload._id;
        if (payload.__v) delete payload.__v;
        if (payload.id) delete payload.id;
        this.http.postCall('/api/students/inserisci', payload).subscribe({
          next: (res) =>{
            this.auth.saveToken(res.newToken);
            this.successMessage = "Studente salvato con successo";
            this.loadAll();
            this.showForm = false;
            this.cdr.detectChanges();
          },
          error: (err) => {
            this.errorMessage = "Errore nel salvataggio dello studente";
            this.cdr.detectChanges();
          }
        });
      }
    } else {
      // Inserimento rapido: invio direttamente il form per creare un nuovo studente.
      this.http.postCall('/api/students/inserisci', this.formData).subscribe({
        next: (res) => {
          this.auth.saveToken(res.newToken);
          this.successMessage = "Studente aggiunto con successo";
          this.loadAll();
          this.cdr.detectChanges();
        }
      });
    }
  }

  annulla(){
    // Chiudo il form e azzero lo stato di editing.
    this.showForm=false;
    this.isEditing = false;
    this.studenteSelezionato = null;
    this.formData = {};
    this.interessiString = '';
    this.corsiString = '';
  }

  elimina(studente: Student){
    // Elimino lo studente usando nome e cognome come chiave di ricerca.
    this.http.postCall('/api/students/elimina', { nome: studente.nome, cognome: studente.cognome }).subscribe({
      next: (res) => {
        this.auth.saveToken(res.newToken);
        this.successMessage = "Studente eliminato con successo";
        this.loadAll();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.errorMessage = "Errore nell'eliminazione dello studente";
        this.cdr.detectChanges();
      }
    });
  }
}
