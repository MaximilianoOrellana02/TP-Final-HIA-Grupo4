import express from "express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import usuarioRoutes from "./routes/usuario.routes";
import clienteRoutes from "./routes/cliente.routes";
import productoRoutes from "./routes/producto.routes";
import historialRoutes from "./routes/historial.routes";
import barrioRoutes from "./routes/barrio.routes";
import stockRoutes from "./routes/stock.routes";
import mercadopagoRoutes from "./routes/mercadopago.routes";
import repartoRoutes from "./routes/reparto.routes";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

const origenesPermitidos = process.env.FRONTEND_URL
  ? [process.env.FRONTEND_URL]
  : true;

app.use(cors({ origin: origenesPermitidos }));

app.use(express.json({ limit: "100kb" }));

const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Demasiadas peticiones. Intenta nuevamente mas tarde." },
});

app.use("/api", apiRateLimiter);

app.use("/api/health", (req, res) => {
  res.json({
    status: "ok",
  });
});

// Acá rutas
app.use("/api/usuarios", usuarioRoutes);
app.use("/api/clientes", clienteRoutes);
app.use("/api/productos", productoRoutes);
app.use("/api/historial", historialRoutes);
app.use("/api/barrios", barrioRoutes);
app.use("/api/stock", stockRoutes);
app.use("/api/mercadopago", mercadopagoRoutes);
app.use("/api/repartos", repartoRoutes);

export default app;
