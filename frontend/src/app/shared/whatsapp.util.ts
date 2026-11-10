export function armarLinkWhatsapp(telefono: string, mensaje: string): string {
    const soloDigitos = telefono.replace(/\D/g, '');
    const numeroInternacional = `549${soloDigitos}`;
    const mensajeCodificado = encodeURIComponent(mensaje);
    return `https://wa.me/${numeroInternacional}?text=${mensajeCodificado}`;
}