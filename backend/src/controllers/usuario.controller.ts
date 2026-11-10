import { Request, Response } from "express";
import { Op, literal } from "sequelize";
import bcrypt from "bcrypt";
import { randomBytes } from "node:crypto";
import Usuario from "../models/Usuario";
import { AuthRequest } from "../middlewares/auth.middleware";
import { enviarEmailRecuperacion } from "../services/email.service";
import {
  crearRecuperacion,
  crearSesion,
  hashRecuperacion,
} from "../services/token.service";
import {
  cuerpo,
  emailValido,
  passwordLoginValida,
  passwordValida,
  rolValido,
  texto,
} from "../utils/usuario.validation";
import { responderErrorUsuario } from "../utils/usuario.error";

const SALT_ROUNDS = 10;
const dummyHash = bcrypt.hash(randomBytes(32).toString("hex"), SALT_ROUNDS);
const passwordError =
  "La contrasena debe tener al menos 6 caracteres no vacios y como maximo 72 bytes";
const resetError = "El link expiro o no es valido";

function datosPublicos(usuario: Usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    nombreCompleto: usuario.nombreCompleto,
    email: usuario.email,
    rol: usuario.rol,
  };
}

export async function registrar(req: Request, res: Response) {
  const body = cuerpo(req);
  const username = texto(body.username, 50);
  const nombreCompleto = texto(body.nombreCompleto, 100);
  const email = emailValido(body.email);
  const rol = rolValido(body.rol);
  if (!username || !nombreCompleto || !email)
    return res
      .status(400)
      .json({ error: "Username, nombre completo o email invalidos" });
  if (!rol)
    return res
      .status(400)
      .json({ error: "rol debe ser admin o repartidor" });
  if (!passwordValida(body.password))
    return res.status(400).json({ error: passwordError });
  try {
    const existente = await Usuario.findOne({
      where: { [Op.or]: [{ username }, { email }] },
    });
    if (existente)
      return res
        .status(409)
        .json({ error: "El username o email ya esta registrado" });
    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);
    const usuario = await Usuario.create({
      username,
      nombreCompleto,
      email,
      passwordHash,
      rol,
    });
    return res.status(201).json(datosPublicos(usuario));
  } catch (error) {
    return responderErrorUsuario(res, error, "Error al registrar usuario");
  }
}

export async function login(req: Request, res: Response) {
  const body = cuerpo(req);
  const username = texto(body.username, 50);
  if (!username || !passwordLoginValida(body.password))
    return res.status(400).json({ error: "Username o contrasena invalidos" });
  try {
    const usuario = await Usuario.findOne({ where: { username } });
    const valida = await bcrypt.compare(
      body.password,
      usuario ? usuario.passwordHash : await dummyHash,
    );
    if (!usuario || !valida)
      return res
        .status(401)
        .json({ error: "Usuario o contrasena incorrectos" });
    return res.json({
      token: crearSesion(usuario),
      usuario: datosPublicos(usuario),
    });
  } catch (error) {
    return responderErrorUsuario(res, error, "Error al iniciar sesion");
  }
}

export async function solicitarRecuperacion(req: Request, res: Response) {
  const email = emailValido(cuerpo(req).email);
  if (!email) return res.status(400).json({ error: "Email invalido" });
  try {
    const base = process.env.FRONTEND_URL_RESET;
    if (!base) throw new Error("FRONTEND_URL_RESET es obligatorio");
    const link = new URL("/restablecer", base);
    if (!["http:", "https:"].includes(link.protocol))
      throw new Error("FRONTEND_URL_RESET invalido");
    const usuario = await Usuario.findOne({ where: { email } });
    if (usuario) {
      const reset = crearRecuperacion();
      const [updated] = await Usuario.update(
        { resetTokenHash: reset.hash, resetTokenExpiresAt: reset.expiresAt },
        {
          where: { id: usuario.id, sessionVersion: usuario.sessionVersion },
        },
      );
      if (updated) {
        link.searchParams.set("token", reset.token);
        try {
          await enviarEmailRecuperacion(
            usuario.email,
            usuario.nombreCompleto,
            link.toString(),
          );
        } catch {
          console.error("No se pudo enviar el correo de recuperacion");
          await Usuario.update(
            { resetTokenHash: null, resetTokenExpiresAt: null },
            { where: { id: usuario.id, resetTokenHash: reset.hash } },
          );
        }
      }
    }
    return res.json({
      mensaje: "Si el email existe, te enviamos instrucciones",
    });
  } catch (error) {
    return responderErrorUsuario(res, error, "Error al procesar la solicitud");
  }
}

export async function restablecerPassword(req: Request, res: Response) {
  const { token, passwordNueva } = cuerpo(req);
  if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token))
    return res.status(400).json({ error: resetError });
  if (!passwordValida(passwordNueva))
    return res.status(400).json({ error: passwordError });
  try {
    const hash = hashRecuperacion(token);
    const usuario = await Usuario.findOne({
      where: {
        resetTokenHash: hash,
        resetTokenExpiresAt: { [Op.gt]: new Date() },
      },
    });
    if (!usuario) return res.status(400).json({ error: resetError });
    const passwordHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    const [updated] = await Usuario.update(
      {
        passwordHash,
        sessionVersion: literal("sessionVersion + 1"),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
      {
        where: {
          id: usuario.id,
          sessionVersion: usuario.sessionVersion,
          resetTokenHash: hash,
          resetTokenExpiresAt: { [Op.gt]: new Date() },
        },
      },
    );
    if (!updated) return res.status(400).json({ error: resetError });
    return res.json({
      mensaje:
        "Contrasena actualizada correctamente. Inicia sesion nuevamente.",
    });
  } catch (error) {
    return responderErrorUsuario(
      res,
      error,
      "Error al restablecer la contrasena",
    );
  }
}

// El front lo usa al abrir la app para refrescar los datos guardados (rol incluido) sin volver a loguearse.
export async function usuarioActual(req: AuthRequest, res: Response) {
  try {
    const usuario = await Usuario.findByPk(req.usuario!.id);
    if (!usuario)
      return res.status(401).json({ error: "Usuario no encontrado o sesion invalida" });
    return res.json(datosPublicos(usuario));
  } catch (error) {
    return responderErrorUsuario(res, error, "Error al obtener el usuario");
  }
}

export async function cambiarPassword(req: AuthRequest, res: Response) {
  const { passwordActual, passwordNueva } = cuerpo(req);
  if (!passwordLoginValida(passwordActual))
    return res.status(400).json({ error: "Contrasena actual invalida" });
  if (!passwordValida(passwordNueva))
    return res.status(400).json({ error: passwordError });
  if (!req.usuario) return res.status(401).json({ error: "Sesion invalida" });
  try {
    const usuario = await Usuario.findByPk(req.usuario.id);
    if (!usuario || usuario.sessionVersion !== req.usuario.sessionVersion)
      return res.status(401).json({ error: "Sesion invalida" });
    if (!(await bcrypt.compare(passwordActual, usuario.passwordHash)))
      return res
        .status(401)
        .json({ error: "La contrasena actual es incorrecta" });
    const passwordHash = await bcrypt.hash(passwordNueva, SALT_ROUNDS);
    const [updated] = await Usuario.update(
      {
        passwordHash,
        sessionVersion: literal("sessionVersion + 1"),
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
      {
        where: { id: usuario.id, sessionVersion: req.usuario.sessionVersion },
      },
    );
    if (!updated) return res.status(401).json({ error: "Sesion invalida" });
    return res.json({
      mensaje:
        "Contrasena actualizada correctamente. Inicia sesion nuevamente.",
    });
  } catch (error) {
    return responderErrorUsuario(res, error, "Error al cambiar la contrasena");
  }
}
