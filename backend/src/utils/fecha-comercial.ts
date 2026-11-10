const formato = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit',
});

export function fechaComercial(fecha = new Date()): string {
    const partes = formato.formatToParts(fecha);
    const valor = (tipo: Intl.DateTimeFormatPartTypes) => partes.find(parte => parte.type === tipo)!.value;
    return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

export function diasComercialesDesde(fecha: Date, hoy = new Date()): number {
    return Math.floor((Date.parse(fechaComercial(hoy)) - Date.parse(fechaComercial(fecha))) / 86400000);
}

// Buenos Aires no aplica horario de verano: el desfase es fijo (-03:00), asi que el dia comercial
// se puede acotar sin depender de la zona horaria del servidor.
export function esDiaComercial(value: unknown): value is string {
    return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00.000-03:00`)) && fechaComercial(new Date(`${value}T12:00:00.000-03:00`)) === value;
}

export function rangoDiaComercial(dia: string): { inicio: Date; fin: Date } {
    return { inicio: new Date(`${dia}T00:00:00.000-03:00`), fin: new Date(`${dia}T23:59:59.999-03:00`) };
}
